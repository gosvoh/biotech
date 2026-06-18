"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const WIDGET_SRC =
  "https://llm.cedne.netcraze.link/embed/anythingllm-chat-widget.min.js";

export default function ChatWidget() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    fetch(WIDGET_SRC, {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal,
    })
      .then(() => {
        setAvailable(true);
      })
      .catch(() => {
        // Widget host unreachable or request timed out: render nothing.
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  if (!available) return null;

  return (
    <Script
      strategy="lazyOnload"
      data-embed-id="e4675477-ad57-4532-a1fc-1a3a966adf8d"
      data-base-api-url="https://llm.cedne.netcraze.link/api/embed"
      src={WIDGET_SRC}
      data-language="ru"
      data-chat-icon="chatBubble"
      data-brand-image-url="/favicon.ico"
      data-assistant-icon="/favicon.ico"
      data-no-sponsor="true"
      data-assistant-name="Секретарь факультета биотехнологий"
      data-support-email="biotech@itmo.ru"
      data-greeting="Привет! Я Секретарь факультета биотехнологий. Чем могу помочь?"
    />
  );
}
