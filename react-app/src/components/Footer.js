import React from 'react';

export default function Footer(){
  return (
    <footer style={{padding:20, textAlign:'center', marginTop:40, background:'#f3f6fb'}}>
      <div>© {new Date().getFullYear()} Gigto. All rights reserved.</div>
    </footer>
  );
}
