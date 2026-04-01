import axios from "axios";
import qs from "qs";

export const sendOtpViaGupshupSMS = async (
  countryCode: string,
  phoneNumber: string,
  otp: string
) => {
  const url = "https://enterprise.smsgupshup.com/GatewayAPI/rest";

  const payload = qs.stringify({
    userid: process.env.GUPSHUP_USER_ID,    
    method: "sendMessage",                   
    msg_type: "text",                        
    format: "json",
    auth_scheme: "plain",
    v: "1.1",
    send_to: `${countryCode}${phoneNumber}`,
    msg: `Dear user, your Wingmawo login OTP is ${otp}. Do not share this with anyone`,
    password: process.env.GUPSHUP_PASSWORD,   
  });

  const response = await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 10000,
  });
  return response.data;
};
