"use client";

import { useEffect, useRef, useState } from "react";

export default function Greeting() {
  const [name, setName] = useState("there");
  const [day, setDay] = useState("");
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("padlet:name");
    setName(saved || "afzaana");
    setDay(new Date().toLocaleDateString("en-US", { weekday: "long" }));
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function save(value: string) {
    const trimmed = value.trim();
    const next = trimmed || "there";
    setName(next);
    localStorage.setItem("padlet:name", next);
    setEditing(false);
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 leading-tight">
        Hi{" "}
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={name}
            onBlur={(e) => save(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save((e.target as HTMLInputElement).value);
              if (e.key === "Escape") setEditing(false);
            }}
            className="border-b border-violet-400 bg-transparent focus:outline-none w-32"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="hover:underline decoration-dotted decoration-slate-400 underline-offset-4"
            title="Click to change name"
          >
            {name}
          </button>
        )}
      </h2>
      <p className="text-slate-700 text-sm">Happy {day || "day"}!</p>
    </div>
  );
}
