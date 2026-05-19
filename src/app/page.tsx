"use client";

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react";
import styles from "./page.module.css";

interface BBox {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  bbox?: number[];
}

const SYSTEM_PROMPT = `You are an expert at identifying objects in images and providing precise bounding boxes.
When given an image and a query about objects in it, analyze the image carefully and return bounding boxes for the requested objects.

Always respond with valid JSON containing 'thinking' (string describing your analysis) and 'bbox' (array of 4 integers [x, y, width, height] in raw pixels).

Example response format:
{"thinking": "I found a person in the left portion of the image.", "bbox": [100, 200, 150, 400]}`;

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bboxes, setBboxes] = useState<BBox[]>([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      processFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImage(result);
      setFileName(file.name);
      setBboxes([]);
      setMessages([]);
    };
    reader.readAsDataURL(file);
  };

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (img) {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    }
  }, []);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setBboxes([]);

    try {
      const messageHistory = [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: input },
      ];

      const response = await fetch("/api/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messageHistory,
          imageBase64: image ? image.split(",")[1] : undefined,
          imageWidth: imageDimensions.width,
          imageHeight: imageDimensions.height,
        }),
      });

      const data = await response.json();

      if (data.error) {
        const errorMsg: Message = { role: "assistant", content: `Error: ${data.error}` };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.thinking || data.text || "I've analyzed the image.",
        thinking: data.thinking,
        bbox: data.bbox,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (data.bbox && Array.isArray(data.bbox) && data.bbox.length === 4) {
        const [x, y, width, height] = data.bbox;
        setBboxes([{ label: "object", x: x / imageDimensions.width, y: y / imageDimensions.height, width: width / imageDimensions.width, height: height / imageDimensions.height }]);
      }
    } catch (error) {
      const errorMsg: Message = { role: "assistant", content: "Failed to get response. Please try again." };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <div className={styles.header}>
          <h1>LLM BBox Demo</h1>
          <p>Drop an image and describe what you want to find</p>
        </div>

        <div
          className={`${styles.dropZone} ${isDragging ? styles.dragging : ""} ${image ? styles.hasImage : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className={styles.fileInput}
          />

          {!image ? (
            <div className={styles.dropContent}>
              <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p>Drop an image here or click to upload</p>
              <span>Supports JPEG, PNG, WebP</span>
            </div>
          ) : (
            <div className={styles.imageContainer}>
              <img
                ref={imageRef}
                src={image}
                alt="Preview"
                className={styles.previewImage}
                onLoad={handleImageLoad}
              />
              {bboxes.map((bbox, index) => (
                <div
                  key={index}
                  className={styles.bboxOverlay}
                  style={{
                    left: `${bbox.x * 100}%`,
                    top: `${bbox.y * 100}%`,
                    width: `${bbox.width * 100}%`,
                    height: `${bbox.height * 100}%`,
                  }}
                >
                  <div className={styles.bboxLabel}>{bbox.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {image && (
          <div className={styles.imageInfo}>
            <span>{fileName}</span>
            {imageDimensions.width > 0 && (
              <span>{imageDimensions.width} × {imageDimensions.height}</span>
            )}
            <button className={styles.clearBtn} onClick={() => { setImage(null); setBboxes([]); setMessages([]); }}>
              Clear
            </button>
          </div>
        )}
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.chatHeader}>
          <h2>Chat</h2>
        </div>

        <div className={styles.messageList}>
          {messages.length === 0 && (
            <div className={styles.emptyState}>
              <p>Describe objects in your image to get bounding boxes</p>
              <p className={styles.hint}>Try: &quot;Find the person in the image&quot;</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`${styles.message} ${styles[msg.role]}`}>
              <div className={styles.messageContent}>{msg.content}</div>
            </div>
          ))}

          {isLoading && (
            <div className={`${styles.message} ${styles.assistant}`}>
              <div className={styles.thinking}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className={styles.inputArea}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to find..."
            className={styles.input}
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className={styles.sendBtn}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22,2 15,22 11,13 2,9" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}