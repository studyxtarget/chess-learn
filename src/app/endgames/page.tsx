"use client";

import { useEffect, useState } from "react";
import Course, { type CourseData } from "@/components/Course";
import { asset } from "@/lib/data";

export default function EndgamesPage() {
  const [data, setData] = useState<CourseData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(asset("/data/endgames.json"))
      .then((r) => r.json())
      .then((d: CourseData) => setData(d))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <div className="container section"><p className="muted">Could not load the course.</p></div>;
  if (!data) return <div className="container section"><p className="muted"><span className="spinner" /> Loading course…</p></div>;

  return (
    <Course
      title="Endgames"
      intro="Six levels of endgame technique, from a lone king and pawn up to rook endings and mating with bishop and knight. One position per lesson, with the key squares marked."
      data={data}
      storageKey="chesslearn.endgamesProgress"
    />
  );
}
