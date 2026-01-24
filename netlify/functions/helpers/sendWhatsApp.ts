interface WhatsAppTemplateParams {
  to: string; // E.164 format
  templateName: string;
  languageCode?: string;
  components?: Array<{
    type: "header" | "body";
    parameters: Array<{ type: "text"; text: string }>;
  }>;
}

interface WhatsAppImageParams {
  to: string;
  imageUrl: string;
  caption?: string;
}

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

export const sendWhatsAppTemplate = async (
  params: WhatsAppTemplateParams
): Promise<WhatsAppResponse> => {
  const { to, templateName, languageCode = "en", components = [] } = params;

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace("+", ""), // Remove + for API
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API error:", data);
      return { success: false, error: data.error?.message || "Unknown error" };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("WhatsApp send error:", errorMessage);
    return { success: false, error: errorMessage };
  }
};

export const sendWhatsAppImage = async (
  params: WhatsAppImageParams
): Promise<WhatsAppResponse> => {
  const { to, imageUrl, caption } = params;

  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace("+", ""),
          type: "image",
          image: {
            link: imageUrl,
            caption,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message || "Unknown error" };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

// Combined function to send event confirmation with QR
export const sendEventConfirmation = async (params: {
  to: string;
  name: string;
  eventTitle: string;
  datetime: string;
  venue: string;
  passId: string;
  qrImageUrl: string;
}): Promise<{ templateSent: boolean; imageSent: boolean; errors: string[] }> => {
  const errors: string[] = [];

  // 1. Send template message
  const templateResult = await sendWhatsAppTemplate({
    to: params.to,
    templateName: "booking_event_confirmed",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.name },
          { type: "text", text: params.eventTitle },
          { type: "text", text: params.datetime },
          { type: "text", text: params.venue },
          { type: "text", text: params.passId },
        ],
      },
    ],
  });

  if (!templateResult.success) {
    errors.push(`Template: ${templateResult.error}`);
  }

  // 2. Send QR image
  const imageResult = await sendWhatsAppImage({
    to: params.to,
    imageUrl: params.qrImageUrl,
    caption: `🎫 Your Event Pass\n\nPass ID: ${params.passId}\n\nShow this QR code at the venue for check-in.`,
  });

  if (!imageResult.success) {
    errors.push(`Image: ${imageResult.error}`);
  }

  return {
    templateSent: templateResult.success,
    imageSent: imageResult.success,
    errors,
  };
};

// Send class confirmation
export const sendClassConfirmation = async (params: {
  to: string;
  name: string;
  classTitle: string;
  date: string;
  time: string;
  bookingId: string;
}): Promise<WhatsAppResponse> => {
  return sendWhatsAppTemplate({
    to: params.to,
    templateName: "booking_class_confirmed",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.name },
          { type: "text", text: params.classTitle },
          { type: "text", text: params.date },
          { type: "text", text: params.time },
          { type: "text", text: params.bookingId },
        ],
      },
    ],
  });
};

// Send space call confirmation
export const sendSpaceCallConfirmation = async (params: {
  to: string;
  name: string;
  date: string;
  time: string;
}): Promise<WhatsAppResponse> => {
  return sendWhatsAppTemplate({
    to: params.to,
    templateName: "space_call_confirmed",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.name },
          { type: "text", text: params.date },
          { type: "text", text: params.time },
        ],
      },
    ],
  });
};
