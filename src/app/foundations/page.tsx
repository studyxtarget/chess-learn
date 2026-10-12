"use client";

import { useEffect, useState } from "react";
import Course, { type CourseData } from "@/components/Course";
import { asset } from "@/lib/data";

export default function FoundationsPage() {
  const [data, setData] = useState<CourseData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(asset("/data/foundations.json"))
      .then((r) => r.json())
      .then((d: CourseData) => setData(d))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <div className="container section"><p className="muted">Could not load the course.</p></div>;
  if (!data) return <div className="container section"><p className="muted"><span className="spinner" /> Loading course…</p></div>;

  return (
    <Course
      title="Foundations"
      intro="A six-level course that starts from how the pieces move and builds up to real plans. Each lesson shows one position — step through it, then mark it done to unlock the next."
      data={data}
      storageKey="chesslearn.foundationsProgress"
    />
  );
}
