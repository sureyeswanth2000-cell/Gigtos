const functions = require('firebase-functions');
const cors = require('cors')({ origin: true });

// Example HTTP endpoint with CORS enabled
exports.getServiceInsights = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    // Example response (replace with your logic)
    res.status(200).json({
      message: 'Service insights endpoint is working and CORS is enabled!',
      timestamp: new Date().toISOString(),
    });
  });
});
