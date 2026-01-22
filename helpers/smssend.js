const axios = require("axios");
const sendSMS = async (phone, otp) => {
  const message = `Your OTP for RUYAPP account verification is: ${otp}
Please enter this code in the app to complete your verification.
Do not share this OTP with anyone.

Team Rupya - Epic Corporation`;

  const url = `http://sms.designhost.in/api/mt/SendSMS?user=epiccorporations&password=Epic%40123&senderid=RPYAPP&channel=Trans&DCS=0&flashsms=0&number=${phone}&text=${encodeURIComponent(message)}&route=1&peid=1301159686225205571&DLTTemplateId=1207176837342946517`;

  return axios.get(url);
};

module.exports=sendSMS