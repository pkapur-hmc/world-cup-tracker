"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { setAvatarUrlAction } from "@/app/(app)/account-actions";

export function AvatarUploader({
  userId,
  displayName,
  avatarUrl,
}: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const [photo, setPhoto] = useState<string | null>(avatarUrl);
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const key = `${userId}/avatar-${Date.now()}.${ext}`;

    startTransition(async () => {
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(key, file, { upsert: true, contentType: file.type });
      if (upErr) {
        setErr(upErr.message);
        return;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(key);
      const publicUrl = pub.publicUrl;
      const res = await setAvatarUrlAction(publicUrl);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setPhoto(publicUrl);
    });
  }

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        aria-label="Change profile photo"
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          border: "2px solid var(--stout)",
          overflow: "hidden",
          padding: 0,
          cursor: "pointer",
          background: photo ? "transparent" : "var(--burn)",
          color: "var(--foam-lit)",
          display: "grid",
          placeItems: "center",
          flex: "0 0 72px",
          position: "relative",
        }}
      >
        {photo ? (
          <Image
            src={photo}
            alt=""
            width={72}
            height={72}
            style={{ objectFit: "cover", width: 72, height: 72 }}
            unoptimized
          />
        ) : (
          <span style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 800 }}>
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--pour)",
            border: "1.5px solid var(--stout)",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            color: "var(--stout)",
          }}
          aria-hidden
        >
          ✎
        </span>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-sub" style={{ fontSize: 17 }}>{displayName}</div>
        <div className="t-small muted">Photo shows in every bracket</div>
        <button
          type="button"
          className="link"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          style={{ padding: 0, marginTop: 4 }}
        >
          {busy ? "Uploading..." : photo ? "Change photo" : "Add a photo"}
        </button>
        {err ? (
          <div className="t-small" style={{ color: "var(--penalty)", marginTop: 4 }}>
            {err}
          </div>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
