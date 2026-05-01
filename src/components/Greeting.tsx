"use client";

import { useEffect, useState } from "react";

export default function Greeting() {
  const [name, setName] = useState("");
  const [day, setDay] = useState("");

  useEffect(() => {
    setDay(new Date().toLocaleDateString("en-US", { weekday: "long" }));
    try {
      localStorage.removeItem("padlet:name");
    } catch {}
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight flex items-baseline gap-2 flex-wrap">
        <span>Hi</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name"
          className="border-b border-violet-400 dark:border-violet-500 bg-transparent focus:outline-none w-36 text-violet-700 dark:text-violet-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal placeholder:italic"
        />
      </h2>
      <p className="text-slate-600 dark:text-slate-400 text-sm">{day ? `Happy ${day}!` : " "}</p>
    </div>
  );
}
