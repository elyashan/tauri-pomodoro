import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  FeedbackCategory,
  FeedbackItem,
  addFeedback,
  deleteFeedback,
  getFeedbacks,
} from "../db";

export function useFeedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbackCat, setFeedbackCat] = useState<FeedbackCategory>("feature");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCopied, setFeedbackCopied] = useState(false);

  const hydrateFeedbacks = async () => {
    setFeedbacks(await getFeedbacks());
  };

  const handleAddFeedbackItem = async () => {
    if (!feedbackText.trim()) return;
    await addFeedback(feedbackCat, feedbackText.trim());
    setFeedbackText("");
    setFeedbacks(await getFeedbacks());
  };

  const handleDeleteFeedbackItem = async (id: number) => {
    await deleteFeedback(id);
    setFeedbacks(await getFeedbacks());
  };

  const handleCopyAllFeedbacks = async () => {
    if (feedbacks.length === 0) return;
    const lines = feedbacks.map(
      (f, idx) =>
        `${idx + 1}. [${f.category.toUpperCase()}] (${f.created_at.slice(0, 10)})\n${f.message}`,
    );
    await navigator.clipboard.writeText(lines.join("\n\n")).catch(() => {});
    setFeedbackCopied(true);
    setTimeout(() => setFeedbackCopied(false), 1800);
  };

  const handleOpenGithubFeedback = async () => {
    const title = encodeURIComponent(
      `[Feedback] ${feedbackText.trim().slice(0, 50) || "Pomodoro Widget"}`,
    );
    const body = encodeURIComponent(
      feedbackText.trim() ||
        feedbacks.map((f) => `- **[${f.category}]** ${f.message}`).join("\n"),
    );
    await openUrl(
      `https://github.com/elyashan/tauri-pomodoro/issues/new?title=${title}&body=${body}`,
    ).catch(() => {});
  };

  return {
    feedbacks,
    feedbackCat,
    setFeedbackCat,
    feedbackText,
    setFeedbackText,
    feedbackCopied,
    hydrateFeedbacks,
    handleAddFeedbackItem,
    handleDeleteFeedbackItem,
    handleCopyAllFeedbacks,
    handleOpenGithubFeedback,
  };
}
