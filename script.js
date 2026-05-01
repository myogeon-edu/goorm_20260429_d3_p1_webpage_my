(function () {
  const STORAGE_KEY = "smart-task-planner:v1";
  const THEME_KEY = "smart-task-planner:theme";

  /** @type {{ goal: string, dailyHours: number, startDate: string, tasks: Array<{ id: string, title: string, durationHours: number, done: boolean }> }} */
  let state = {
    goal: "",
    dailyHours: 2,
    startDate: todayYmd(),
    tasks: [],
  };

  const goalInput = document.getElementById("goalInput");
  const generateBtn = document.getElementById("generateBtn");
  const aiStatus = document.getElementById("aiStatus");
  const dailyHoursInput = document.getElementById("dailyHours");
  const startDateInput = document.getElementById("startDate");
  const taskList = document.getElementById("taskList");
  const taskEmpty = document.getElementById("taskEmpty");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const scheduleEl = document.getElementById("schedule");
  const scheduleEmpty = document.getElementById("scheduleEmpty");
  const themeToggle = document.getElementById("themeToggle");

  function todayYmd() {
    const d = new Date();
    return formatYmd(d);
  }

  function formatYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseYmd(s) {
    const parts = String(s).split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
      return new Date();
    }
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function newId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  /**
   * @param {Array<{ title: string, durationHours: number, done: boolean }>} tasks
   * @param {number} dailyHours
   * @param {string} startDateYmd
   */
  function scheduleTasks(tasks, dailyHours, startDateYmd) {
    const cap = Number(dailyHours);
    if (!Number.isFinite(cap) || cap <= 0) {
      return [];
    }

    const active = tasks.filter((t) => !t.done);
    const result = [];
    const current = parseYmd(startDateYmd);

    active.forEach((item) => {
      let remaining = Number(item.durationHours);
      if (!Number.isFinite(remaining) || remaining <= 0) {
        return;
      }
      const totalParts = Math.ceil(remaining / cap);
      let partIndex = 0;

      while (remaining > 0) {
        const work = Math.min(remaining, cap);
        partIndex += 1;
        const label =
          totalParts > 1
            ? `${item.title} (${partIndex}/${totalParts})`
            : item.title;
        result.push({
          date: formatYmd(current),
          task: label,
          hours: work,
        });
        remaining -= work;
        current.setDate(current.getDate() + 1);
      }
    });

    return result;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        state = {
          goal: String(data.goal || ""),
          dailyHours: Math.max(0.5, Number(data.dailyHours) || 2),
          startDate: String(data.startDate || todayYmd()),
          tasks: Array.isArray(data.tasks)
            ? data.tasks
                .filter(
                  (t) =>
                    t &&
                    typeof t === "object" &&
                    typeof t.title === "string" &&
                    Number.isFinite(Number(t.durationHours))
                )
                .map((t) => ({
                  id: String(t.id || newId()),
                  title: String(t.title),
                  durationHours: Math.max(0.5, Number(t.durationHours)),
                  done: Boolean(t.done),
                }))
            : [],
        };
      }
    } catch {
      /* ignore */
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function applyThemeFromStorage() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
      return;
    }
    document.documentElement.removeAttribute("data-theme");
  }

  function toggleTheme() {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current = root.getAttribute("data-theme");
    let next;
    if (current === "dark") next = "light";
    else if (current === "light") next = "dark";
    else next = prefersDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }

  function setAiStatus(text, isError) {
    aiStatus.textContent = text || "";
    aiStatus.classList.toggle("hint--error", Boolean(isError));
  }

  function syncFormFromState() {
    goalInput.value = state.goal;
    dailyHoursInput.value = String(state.dailyHours);
    startDateInput.value = state.startDate;
  }

  function renderTasks() {
    taskList.innerHTML = "";
    const hasTasks = state.tasks.length > 0;
    taskEmpty.classList.toggle("empty--hidden", hasTasks);

    state.tasks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "task-item" + (t.done ? " task-item--done" : "");
      li.dataset.id = t.id;

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "task-item__check";
      check.checked = t.done;
      check.addEventListener("change", () => {
        t.done = check.checked;
        saveState();
        renderTasks();
        renderSchedule();
      });

      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "input task-item__title";
      titleInput.value = t.title;
      titleInput.addEventListener("change", () => {
        t.title = titleInput.value.trim() || t.title;
        saveState();
        renderSchedule();
      });

      const hoursInput = document.createElement("input");
      hoursInput.type = "number";
      hoursInput.className = "input task-item__hours";
      hoursInput.min = "0.5";
      hoursInput.max = "999";
      hoursInput.step = "0.5";
      hoursInput.value = String(t.durationHours);
      hoursInput.addEventListener("change", () => {
        const n = Number(hoursInput.value);
        t.durationHours = Number.isFinite(n) && n > 0 ? n : t.durationHours;
        hoursInput.value = String(t.durationHours);
        saveState();
        renderSchedule();
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn--danger task-item__delete";
      del.textContent = "삭제";
      del.addEventListener("click", () => {
        state.tasks = state.tasks.filter((x) => x.id !== t.id);
        saveState();
        renderTasks();
        renderSchedule();
      });

      li.appendChild(check);
      li.appendChild(titleInput);
      li.appendChild(hoursInput);
      li.appendChild(del);
      taskList.appendChild(li);
    });
  }

  function groupScheduleByDate(rows) {
    /** @type {Record<string, Array<{ task: string, hours: number }>>} */
    const map = {};
    rows.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push({ task: r.task, hours: r.hours });
    });
    return map;
  }

  function renderSchedule() {
    const rows = scheduleTasks(state.tasks, state.dailyHours, state.startDate);
    scheduleEl.innerHTML = "";
    const hasRows = rows.length > 0;
    scheduleEmpty.classList.toggle("empty--hidden", hasRows);

    const grouped = groupScheduleByDate(rows);
    const dates = Object.keys(grouped).sort();

    dates.forEach((date) => {
      const day = document.createElement("div");
      day.className = "schedule-day";
      const h = document.createElement("p");
      h.className = "schedule-day__date";
      h.textContent = date;
      day.appendChild(h);
      grouped[date].forEach((slot) => {
        const p = document.createElement("p");
        p.className = "schedule-day__task";
        p.textContent = slot.task;
        const sub = document.createElement("p");
        sub.className = "schedule-day__hours";
        sub.textContent = `예상 ${slot.hours}시간`;
        day.appendChild(p);
        day.appendChild(sub);
      });
      scheduleEl.appendChild(day);
    });
  }

  function addEmptyTask() {
    state.tasks.push({
      id: newId(),
      title: "새 작업",
      durationHours: 1,
      done: false,
    });
    saveState();
    renderTasks();
    renderSchedule();
  }

  generateBtn.addEventListener("click", async () => {
    const goal = goalInput.value.trim();
    state.goal = goal;
    if (!goal) {
      setAiStatus("목표를 입력해 주세요.", true);
      return;
    }
    setAiStatus("AI가 계획을 생성하는 중…", false);
    generateBtn.disabled = true;
    try {
      const list = await generateTasksFromGoal(goal);
      state.tasks = list.map((item) => ({
        id: newId(),
        title: item.task,
        durationHours: Math.max(0.5, item.duration),
        done: false,
      }));
      saveState();
      syncFormFromState();
      renderTasks();
      renderSchedule();
      setAiStatus("계획이 생성되었습니다.", false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setAiStatus(msg, true);
    } finally {
      generateBtn.disabled = false;
    }
  });

  dailyHoursInput.addEventListener("change", () => {
    const n = Number(dailyHoursInput.value);
    state.dailyHours = Number.isFinite(n) && n > 0 ? n : state.dailyHours;
    dailyHoursInput.value = String(state.dailyHours);
    saveState();
    renderSchedule();
  });

  startDateInput.addEventListener("change", () => {
    state.startDate = startDateInput.value || todayYmd();
    saveState();
    renderSchedule();
  });

  goalInput.addEventListener("change", () => {
    state.goal = goalInput.value.trim();
    saveState();
  });

  addTaskBtn.addEventListener("click", addEmptyTask);
  themeToggle.addEventListener("click", toggleTheme);

  applyThemeFromStorage();
  loadState();
  syncFormFromState();
  if (!startDateInput.value) {
    state.startDate = todayYmd();
    startDateInput.value = state.startDate;
    saveState();
  }
  renderTasks();
  renderSchedule();
})();
