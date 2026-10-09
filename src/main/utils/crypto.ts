import crypto, { Encoding } from "crypto";

function aesEncode(algorithm: string, key: string, iv: string, value: string, encoding: Encoding = "hex") {
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), Buffer.from(iv));
  return cipher.update(value, "utf8", encoding) + cipher.final(encoding);
}

function aesDecode(algorithm: string, key: string, iv: string, value: string, encoding: Encoding = "hex") {
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), Buffer.from(iv));
  return decipher.update(value, encoding, "utf8") + decipher.final("utf8");
}

export const aes256Encode = (key: string, iv: string, value: string) => aesEncode("aes-256-cbc", key, iv, value);
export const aes256Decode = (key: string, iv: string, value: string) => aesDecode("aes-256-cbc", key, iv, value);
export const aes128Encode = (key: string, iv: string, value: string) => aesEncode("aes-128-cbc", key, iv, value);
export const aes128Decode = (key: string, iv: string, value: string) => aesDecode("aes-128-cbc", key, iv, value);
export const aes128EncodeBase64 = (key: string, iv: string, value: string) => aesEncode("aes-128-cbc", key, iv, value, "base64");
export const aes128DecodeBase64 = (key: string, iv: string, value: string) => aesDecode("aes-128-cbc", key, iv, value, "base64");
