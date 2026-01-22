const admin = require("firebase-admin");

async function sendPushNotification(fcmToken, title, body) {
  const message = {
    notification: { title, body },
    token: fcmToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Notification sent:', response);
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

module.exports = sendPushNotification;
