import { ImageResponse } from "next/og";
import QRCode from "qrcode";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { sessionId: string } }
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://smashrank.app";
  const joinUrl = `${baseUrl}/session/${params.sessionId}/join`;
  const qrCode = await QRCode.toDataURL(joinUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 420,
  });

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #052e16 0%, #14532d 55%, #166534 100%)",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px 86px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <div style={{ alignItems: "center", display: "flex", fontSize: 34, fontWeight: 700 }}>
            🏸 SmashRank Badminton
          </div>
          <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: "-2px", lineHeight: 1.05, marginTop: 42 }}>
            Scan to Join Court Session
          </div>
          <div style={{ color: "#bbf7d0", fontSize: 28, marginTop: 30 }}>
            Or tap this link to join directly!
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            background: "white",
            border: "14px solid #dcfce7",
            borderRadius: 34,
            boxShadow: "0 22px 45px rgba(0, 0, 0, 0.28)",
            display: "flex",
            height: 458,
            justifyContent: "center",
            padding: 18,
            width: 458,
          }}
        >
          {/* next/image is not supported in ImageResponse JSX. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="QR code to join this SmashRank session" height="420" src={qrCode} width="420" />
        </div>
      </div>
    ),
    { height: 630, width: 1200 }
  );
}
