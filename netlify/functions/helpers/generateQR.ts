import QRCode from "qrcode";

export const generateQRBuffer = async (data: string): Promise<Buffer> => {
  const qrBuffer = await QRCode.toBuffer(data, {
    type: "png",
    width: 400,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
  });
  return qrBuffer;
};

export const generateQRDataURL = async (data: string): Promise<string> => {
  const qrDataURL = await QRCode.toDataURL(data, {
    type: "image/png",
    width: 400,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "H",
  });
  return qrDataURL;
};
