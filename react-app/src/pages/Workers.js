import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';

export default function Workers(){
  const [user, setUser] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [gigType, setGigType] = useState('Plumber');

  useEffect(()=>{
    const unsubAuth = onAuthStateChanged(auth, u=> setUser(u));
    return ()=> unsubAuth();
  },[]);

  useEffect(()=>{
    const unsub = onSnapshot(collection(db,'gig_workers'), (snap)=>{
      const list = [];
      snap.forEach(d=> list.push({id:d.id, ...d.data()}));
      setWorkers(list);
    }, err=> console.error(err));
    return ()=> unsub();
  },[]);

  async function createWorker(){
    if(!user) return alert('Not authenticated');
    if(!/^[0-9]{10}$/.test(contact)) return alert('Enter valid 10 digit phone');
    try{
      await addDoc(collection(db,'gig_workers'),{
        name, contact, gigType, status:'active', adminId: user.uid, createdAt: new Date()
      });
      setName(''); setContact('');
    }catch(e){ console.error(e); alert(e.message); }
  }

  async function toggleWorker(id, status){
    try{
      await updateDoc(doc(db,'gig_workers',id),{ status: status==='active'?'inactive':'active' });
    }catch(e){ console.error(e); alert(e.message); }
  }

  return (
    <div style={{padding:20}}>
      <h2>Workers</h2>
      <div style={{background:'#fff',padding:12,borderRadius:8,marginBottom:12}}>
        <h4>Create Worker</h4>
        <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} style={{padding:8,marginRight:8}} />
        <input placeholder="10 digit phone" value={contact} onChange={e=>setContact(e.target.value)} style={{padding:8,marginRight:8}} />
        <select value={gigType} onChange={e=>setGigType(e.target.value)} style={{padding:8,marginRight:8}}>
          <option>Plumber</option>
          <option>Electrician</option>
        </select>
        <button onClick={createWorker} style={{padding:8}}>Create</button>
      </div>

      <div>
        <h4>All Workers ({workers.length})</h4>
        {workers.map(w=> (
          <div key={w.id} style={{background:'#fff',padding:12,borderRadius:8,marginBottom:8,display:'flex',justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:700}}>{w.name}</div>
              <div style={{color:'#555'}}>{w.gigType} • {w.contact}</div>
              <div style={{fontSize:12,color:'#666'}}>Owner: {w.adminId || 'n/a'}</div>
            </div>
            <div>
              <div style={{marginBottom:8}}>{w.status}</div>
              <button onClick={()=>toggleWorker(w.id,w.status)} style={{padding:8}}>{w.status==='active'?'Disable':'Enable'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
