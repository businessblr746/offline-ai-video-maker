
const ALLOWED_ORIGIN = "https://businessblr746.github.io";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return Response.json(
        { error: "Use POST to generate a video." },
        { status: 405, headers: cors }
      );
    }

    try {
      if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
        throw new Error("Cloudflare credentials are not configured.");
      }

      const form = await request.formData();
      const photo = form.get("photo");
      const script = String(form.get("script") || "").trim();
      const voice = String(form.get("voice") || "Puck (Male)");
      const resolution = String(form.get("resolution") || "720p");

      if (!(photo instanceof File)) {
        throw new Error("Please upload a photo.");
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
        throw new Error("Use a JPG, PNG or WEBP photo.");
      }

      if (photo.size > 10 * 1024 * 1024) {
        throw new Error("Photo must be smaller than 10 MB.");
      }

      if (!script || script.length > 2000) {
        throw new Error("Enter a dialogue of up to 2000 characters.");
      }

      const voices = [
        "Puck (Male)", "Charon (Male)", "Fenrir (Male)",
        "Orus (Male)", "Zephyr (Female)", "Kore (Female)",
        "Leda (Female)", "Aoede (Female)"
      ];

      if (!voices.includes(voice)) {
        throw new Error("Invalid voice selection.");
      }

      if (!["720p", "1080p"].includes(resolution)) {
        throw new Error("Invalid video resolution.");
      }

      const bytes = new Uint8Array(await photo.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }

      const image = `data:${photo.type};base64,${btoa(binary)}`;

      const apiResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/run`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "pruna/p-video-avatar",
            input: {
              image,
              voice_script: script,
              voice,
              voice_language: "Hindi",
              resolution,
              video_prompt: "The person speaks naturally to the camera with accurate lip synchronization and subtle head movements."
            }
          })
        }
      );

      const result = await apiResponse.json();

      if (!apiResponse.ok || result.success === false) {
        return Response.json(
          { error: result.errors?.[0]?.message || "Video generation failed.", details: result },
          { status: 502, headers: cors }
        );
      }

      return Response.json(result, { headers: cors });

    } catch (error) {
      return Response.json(
        { error: error.message || "Something went wrong." },
        { status: 400, headers: cors }
      );
    }
  }
};
