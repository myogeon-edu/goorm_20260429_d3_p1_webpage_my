/**
 * @param {string} goal
 * @returns {Promise<Array<{ task: string, duration: number }>>}
 */
async function generateTasksFromGoal(goal) {
  const trimmed = String(goal || "").trim();
  if (!trimmed) {
    throw new Error("목표를 입력해 주세요.");
  }

  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: trimmed }),
  });

  let data = {};
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("서버 응답을 해석할 수 없습니다.");
  }

  if (!response.ok) {
    const msg =
      data?.error ||
      data?.detail?.error?.message ||
      (typeof data?.detail === "string" ? data.detail : null) ||
      `요청 실패 (${response.status})`;
    throw new Error(String(msg));
  }

  const tasks = data?.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new Error("유효한 Task 목록을 받지 못했습니다.");
  }

  return tasks.map((item, index) => {
    const task = String(item?.task ?? item?.title ?? "").trim();
    const duration = Number(item?.duration ?? item?.durationHours);
    if (!task || !Number.isFinite(duration) || duration <= 0) {
      throw new Error(`Task ${index + 1}번 데이터가 올바르지 않습니다.`);
    }
    return { task, duration };
  });
}
