const apiBase = "";

async function loadCategories() {
  try {
    const res = await fetch(`${apiBase}/api/categories`);
    const list = await res.json();
    const container = document.getElementById("category-list");
    container.innerHTML = "";

    list.forEach((cat) => {
      const div = document.createElement("div");
      div.className = "category-item";
      div.innerText = `${cat.name} (${cat.count})`;
      div.onclick = () => {
        document.querySelectorAll(".category-item").forEach(el => el.classList.remove("active"));
        div.classList.add("active");
        loadReposByCategory(cat.name);
      };
      container.appendChild(div);
    });

    if (list.length > 0) {
      document.querySelector(".category-item").classList.add("active");
      loadReposByCategory(list[0].name);
    }
  } catch (err) {
    console.error("加载分类失败", err);
    alert("加载分类失败，请刷新页面重试");
  }
}

async function loadReposByCategory(category) {
  try {
    document.getElementById("content-title").innerText = category;
    const params = new URLSearchParams({ category, limit: 50 });
    const res = await fetch(`${apiBase}/api/repos?${params}`);
    const repos = await res.json();
    renderRepoList(repos);
  } catch (err) {
    console.error("加载项目失败", err);
    alert("加载项目失败，请刷新页面重试");
  }
}

async function doSearch() {
  const q = document.getElementById("search-input").value.trim();
  if (!q) return;

  try {
    document.getElementById("content-title").innerText = `搜索：${q}`;
    const params = new URLSearchParams({ q });
    const res = await fetch(`${apiBase}/api/search?${params}`);
    const repos = await res.json();
    renderRepoList(repos);
  } catch (err) {
    console.error("搜索失败", err);
    alert("搜索失败，请重试");
  }
}

function renderRepoList(repos) {
  const container = document.getElementById("repo-list");
  container.innerHTML = "";

  if (repos.length === 0) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:#999;font-size:16px">暂无匹配的项目</div>`;
    return;
  }

  repos.forEach((repo) => {
    const card = document.createElement("div");
    card.className = "repo-card";

    const release = repo.latest_release ? JSON.parse(repo.latest_release) : null;
    const downloadUrl = release?.assets?.[0]?.browser_download_url;

    card.innerHTML = `
      <h4>${repo.full_name}</h4>
      <div class="desc">${repo.description || "暂无描述"}</div>
      <div class="repo-meta">
        <span>⭐ ${repo.stars.toLocaleString()}</span>
        <span>${repo.language || "未知语言"}</span>
      </div>
      ${
        downloadUrl
          ? `<button class="download-btn" onclick="startDownload('${downloadUrl}')">下载最新版本</button>`
          : `<span style="color:#999;font-size:12px">暂无二进制下载</span>`
      }
    `;
    container.appendChild(card);
  });
}

async function startDownload(url) {
  try {
    const res = await fetch(`${apiBase}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    if (data.taskId) {
      alert(`下载任务已创建\n任务ID：${data.taskId}\n请在下载管理中查看进度`);
    } else {
      alert("下载启动失败：" + (data.error || "未知错误"));
    }
  } catch (err) {
    console.error(err);
    alert("下载请求异常，请检查服务是否正常运行");
  }
}

document.getElementById("search-btn").onclick = doSearch;
document.getElementById("search-input").onkeydown = (e) => {
  if (e.key === "Enter") doSearch();
};

window.onload = loadCategories;