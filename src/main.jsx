import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Library,
  BookOpen,
  History,
  Bookmark,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  RefreshCw,
  Download,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  FileText,
  Paperclip,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  LockKeyhole,
  LoaderCircle,
  GraduationCap,
  FolderOpen,
  MessageCircle,
  Type,
  Clipboard,
  AlertCircle,
  Move,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api, desktop, wordCount, LEVELS, PUBLICATIONS } from "./api";
import "./style.css";
const INITIAL_PROGRESS = { practices: {}, chat: [] };
const cn = (...classes) => classes.filter(Boolean).join(" ");
function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button className="icon-button" title={label} aria-label={label} {...props}>
      <Icon size={18} />
    </button>
  );
}
function App() {
  const [boot, setBoot] = useState(false),
    [page, setPage] = useState("library"),
    [library, setLibrary] = useState([]),
    [settings, setSettings] = useState(null),
    [progress, setProgress] = useState({}),
    [vocabulary, setVocabulary] = useState([]),
    [articleId, setArticleId] = useState(null),
    [toast, setToast] = useState(null),
    [modal, setModal] = useState(null);
  const progressRef = useRef({});
  useEffect(() => {
    api
      .bootstrap()
      .then((data) => {
        setLibrary(data.library);
        setSettings(data.settings);
        setProgress(data.progress);
        progressRef.current = data.progress;
        setVocabulary(data.vocabulary);
        setArticleId(data.library[6]?.id || data.library[0]?.id);
        setBoot(true);
      })
      .catch((e) => setToast({ message: e.message, error: true }));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  const notify = (message, error = false) => setToast({ message, error });
  const updateProgress = (id, change) => {
    const previous = progressRef.current[id] || INITIAL_PROGRESS;
    const next = {
      ...previous,
      ...(typeof change === "function" ? change(previous) : change),
      updatedAt: new Date().toISOString(),
    };
    progressRef.current = { ...progressRef.current, [id]: next };
    setProgress(progressRef.current);
    api
      .saveProgress({ articleId: id, value: next })
      .catch((e) => notify(e.message, true));
  };
  const openArticle = (article) => {
    setArticleId(article.id);
    updateProgress(article.id, {});
    setPage("reader");
  };
  const imported = (result) => {
    if (result?.pdf) {
      setModal({ type: "pdf", pdf: result.pdf });
      return;
    }
    if (result) {
      setLibrary(result.library);
      notify(
        result.count
          ? `已添加 ${result.count} 篇文章，支持离线阅读`
          : "这些文章已在书架中",
      );
    }
  };
  const importLocal = () =>
    api
      .importFile()
      .then(imported)
      .catch((e) => notify(e.message, true));
  if (!boot)
    return (
      <div className="loading-screen">
        <span className="brand-word">
          folio<span>.</span>
        </span>
        <LoaderCircle className="spin" />
        <p>{toast?.message || "正在整理你的书架…"}</p>
      </div>
    );
  const article = library.find((a) => a.id === articleId);
  const navigation = [
    { id: "library", icon: Library, title: "我的书架", en: "LIBRARY" },
    { id: "reader", icon: BookOpen, title: "阅读工作台", en: "READING" },
    {
      id: "history",
      icon: History,
      title: "历史记录",
      count: Object.keys(progress).length,
    },
    {
      id: "vocabulary",
      icon: Bookmark,
      title: "生词本",
      count: vocabulary.length,
    },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-word">
            folio<span>.</span>
          </span>
          <span className="brand-caption">READ A LITTLE. THINK A LOT.</span>
        </div>
        <div className="nav-label">你的阅读空间</div>
        <nav>
          {navigation.map(({ id, icon: Icon, title, count }) => (
            <button
              key={id}
              className={cn("nav-item", page === id && "active")}
              onClick={() =>
                id === "reader" && article ? openArticle(article) : setPage(id)
              }
            >
              <Icon size={19} />
              <span>{title}</span>
              {count > 0 && <small>{count}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="little-star">✳</div>
          <p>
            不止读懂文字，
            <br />
            更读懂字里行间。
          </p>
          <span>A page a day, a world away.</span>
        </div>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span />
            本地书架 · 离线可读
          </div>
          <button
            className={cn("nav-item", page === "settings" && "active")}
            onClick={() => setPage("settings")}
          >
            <Settings size={19} />
            <span>设置与模型</span>
            <span
              className={cn("key-dot", settings.hasApiKey && "configured")}
            />
          </button>
          <div className="profile">
            <div className="avatar">F</div>
            <div>
              <b>专注，慢慢来</b>
              <small>YOUR PERSONAL READING STUDIO</small>
            </div>
          </div>
        </div>
      </aside>
      <main className={cn("main", page === "reader" && "reader-main")}>
        <header className="topbar">
          <div className="breadcrumb">
            我的空间
            <ChevronRight size={13} />
            <span>
              {
                {
                  library: "我的书架",
                  reader: "阅读工作台",
                  history: "历史记录",
                  vocabulary: "生词本",
                  settings: "设置与模型",
                }[page]
              }
            </span>
          </div>
          <div className="topbar-right">
            <span className="edition">THE READING EDITION</span>
            <span className="topbar-divider" />
            <span className="model-indicator">
              <span />
              {settings.model.split("/").pop()}
            </span>
          </div>
        </header>
        {!desktop && (
          <div className="preview-banner">
            浏览器界面预览 · AI、文件导入和安全存储请使用 Electron 桌面版
          </div>
        )}
        {page === "library" && (
          <LibraryPage
            {...{ library, progress, openArticle, importLocal }}
            onBrowse={(publication) =>
              setModal({ type: "catalog", publication })
            }
            onPaste={() => setModal({ type: "paste" })}
          />
        )}
        {page === "reader" && article && (
          <Reader
            key={article.id}
            {...{ article, settings, notify, vocabulary }}
            progress={progress[article.id] || INITIAL_PROGRESS}
            update={(change) => updateProgress(article.id, change)}
            onSettings={() => setPage("settings")}
            onSaveWord={(entry) =>
              api
                .saveWord({ ...entry, articleTitle: article.title })
                .then(setVocabulary)
            }
          />
        )}
        {page === "history" && (
          <HistoryPage
            {...{ library, progress, openArticle, notify }}
            onDeleted={(value) => {
              setProgress(value);
              progressRef.current = value;
            }}
          />
        )}
        {page === "vocabulary" && (
          <Vocabulary
            {...{ vocabulary, notify }}
            onDelete={(word) => api.deleteWord(word).then(setVocabulary)}
          />
        )}
        {page === "settings" && (
          <SettingsPage {...{ settings, notify }} onSaved={setSettings} />
        )}
      </main>
      {toast && (
        <div className={cn("toast", toast.error && "error")} role="status">
          {toast.error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="关闭提示">
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(null);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal.type === "paste"
                ? "添加文章"
                : modal.type === "pdf"
                  ? "从 PDF 摘选文章"
                  : "刊物目录"
            }
          >
            <IconButton icon={X} label="关闭" onClick={() => setModal(null)} />
            {modal.type === "catalog" ? (
              <Catalog
                publication={modal.publication}
                {...{ library, notify }}
                onImported={imported}
              />
            ) : modal.type === "pdf" ? (
              <PdfArticle
                pdf={modal.pdf}
                notify={notify}
                onImported={imported}
              />
            ) : (
              <PasteArticle
                notify={notify}
                onImported={(result) => {
                  imported(result);
                  setModal(null);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function LibraryPage({
  library,
  progress,
  openArticle,
  importLocal,
  onBrowse,
  onPaste,
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [publicationFilter, setPublicationFilter] = useState(""),
    [visibleCount, setVisibleCount] = useState(80);
  const [updates, setUpdates] = useState(null),
    [checking, setChecking] = useState(false);
  const checkUpdates = async () => {
    setChecking(true);
    const results = await Promise.allSettled(
      PUBLICATIONS.map((p) => api.listRepo(p.path)),
    );
    setUpdates(
      results.map((result, index) => ({
        ...PUBLICATIONS[index],
        ...(result.status === "fulfilled"
          ? {
              items: result.value.items.slice(0, 3),
              cached: result.value.cached,
            }
          : { error: result.reason.message }),
      })),
    );
    setChecking(false);
  };
  const filtered = library.filter(
    (a) =>
      (!publicationFilter || a.publicationId?.startsWith(publicationFilter)) &&
      (filter === "all" ||
        (filter === "recent" && progress[a.id]) ||
        (filter === "mine" && !a.publicationId)) &&
      `${a.title} ${a.source}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="page library-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE WORLD, ONE PAGE AT A TIME</div>
          <h1>让阅读，发生。</h1>
          <p>从一篇好文章开始，把世界读得更深一点。</p>
        </div>
        <button
          className="button secondary"
          onClick={checkUpdates}
          disabled={checking}
        >
          <RefreshCw size={16} className={checking ? "spin" : ""} />
          {checking ? "正在检查…" : "检查刊物更新"}
        </button>
      </div>
      {updates && (
        <div className="update-panel">
          <div className="section-title">
            <b>仓库最新目录</b>
            <IconButton
              icon={X}
              label="收起更新"
              onClick={() => setUpdates(null)}
            />
          </div>
          <div className="update-grid">
            {updates.map((p) => (
              <button key={p.path} onClick={() => onBrowse(p)}>
                <strong>{p.name}</strong>
                <span>
                  {p.error || p.items?.[0]?.name || "暂无目录"}
                  {p.cached ? " · 离线缓存" : ""}
                </span>
                <small>
                  {p.error
                    ? "点击重试"
                    : p.items?.[0] &&
                        library.some((a) => a.publicationId === p.items[0].path)
                      ? "已下载最新一期"
                      : "查看并下载新刊"}
                  <ArrowUpRight size={12} />
                </small>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="section-title">
        <h2>
          你的世界书架 <span>THE PERIODICALS</span>
        </h2>
        <button
          className="text-button"
          onClick={() =>
            api.openExternal(
              "https://github.com/hehonghui/awesome-english-ebooks",
            )
          }
        >
          内容来自 awesome-english-ebooks <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="publication-grid">
        {PUBLICATIONS.map((p, i) => (
          <button
            className="publication-card"
            key={p.path}
            onClick={() =>
              library.some((a) => a.publicationId?.startsWith(p.path))
                ? (setPublicationFilter(p.path), setFilter("all"))
                : onBrowse(p)
            }
          >
            <div className={cn("cover", p.className)}>
              <div className="cover-top">
                <span>
                  {i === 0 ? "SEPTEMBER 12TH, 2026" : "THE READING COLLECTION"}
                </span>
                <ArrowUpRight size={16} />
              </div>
              <div className="cover-name">
                {i === 0 ? (
                  <>
                    The
                    <br />
                    Economist
                  </>
                ) : i === 1 ? (
                  <>
                    THE
                    <br />
                    NEW YORKER
                  </>
                ) : i === 2 ? (
                  <>
                    The
                    <br />
                    <em>Atlantic</em>
                  </>
                ) : (
                  <>
                    W<span>I</span>RED
                  </>
                )}
              </div>
              <div className="cover-art">
                {i === 0 ? (
                  <>
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                    <div className="orbit orbit-three" />
                    <div className="cover-art-label">
                      A WORLD
                      <br />
                      IN PERSPECTIVE.
                    </div>
                  </>
                ) : i === 1 ? (
                  <>
                    <div className="city city-one" />
                    <div className="city city-two" />
                    <div className="city city-three" />
                    <span className="sun" />
                  </>
                ) : i === 2 ? (
                  <>
                    <span className="atlantic-letter">A</span>
                    <div className="cover-art-label">
                      IDEAS THAT
                      <br />
                      STAY WITH YOU.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="wired-grid" />
                    <span className="wired-label">
                      WHAT
                      <br />
                      COMES
                      <br />
                      NEXT?
                    </span>
                  </>
                )}
              </div>
              <div className="cover-footer">
                {p.category}
                <span>EN ↗</span>
              </div>
            </div>
            <div className="publication-meta">
              <strong>{p.cn}</strong>
              <span>
                {library.some((a) => a.publicationId?.startsWith(p.path)) ? (
                  <>
                    <span className="status-dot" />
                    已下载 ·{" "}
                    {
                      library.filter((a) => a.publicationId?.startsWith(p.path))
                        .length
                    }{" "}
                    篇
                  </>
                ) : (
                  p.cadence
                )}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="library-toolbar">
        <div className="tabs">
          {[
            ["all", "全部文章"],
            ["recent", "最近阅读"],
            ["mine", "我的文章"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "selected" : ""}
              onClick={() => {
                setFilter(key);
                if (key === "all") setPublicationFilter("");
              }}
            >
              {label}
              {key === "all" && <small>{library.length}</small>}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="搜索文章"
              placeholder="搜索文章、刊物…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button className="button small secondary" onClick={onPaste}>
            <Plus size={15} />
            粘贴文章
          </button>
          <button className="button small primary" onClick={importLocal}>
            <Download size={15} />
            本地导入
          </button>
        </div>
      </div>
      {publicationFilter && (
        <div className="publication-filter-note">
          <span>
            正在阅读：
            {
              PUBLICATIONS.find((p) => p.path === publicationFilter)?.name
            } · {filtered.length} 篇
          </span>
          <button
            className="text-button"
            onClick={() =>
              onBrowse(PUBLICATIONS.find((p) => p.path === publicationFilter))
            }
          >
            浏览期刊目录
            <ArrowUpRight size={13} />
          </button>
          <button
            className="text-button"
            onClick={() => setPublicationFilter("")}
          >
            显示全部
            <X size={13} />
          </button>
        </div>
      )}
      <div className="article-list">
        <div className="article-table-heading">
          <span>文章 / ARTICLE</span>
          <span>来源</span>
          <span>阅读时长</span>
          <span />
        </div>
        {filtered.slice(0, visibleCount).map((a, i) => (
          <button
            key={a.id}
            className="article-row"
            onClick={() => openArticle(a)}
          >
            <div className="article-title-cell">
              <span className="article-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{a.title}</h3>
                <span>
                  {wordCount(a.text).toLocaleString()} words
                  {progress[a.id] ? " · 继续阅读" : " · 未读"}
                </span>
              </div>
            </div>
            <span className="source-cell">{a.source}</span>
            <span className="time-cell">
              {Math.ceil(wordCount(a.text) / 180)} 分钟
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))}
        {!filtered.length && (
          <Empty
            icon={Search}
            title="没有找到文章"
            text="换个关键词，或导入一篇你想读的文章。"
          />
        )}
        {filtered.length > visibleCount && (
          <button
            className="button secondary full"
            onClick={() => setVisibleCount(visibleCount + 80)}
          >
            加载更多文章 · 还有 {filtered.length - visibleCount} 篇
          </button>
        )}
      </div>
      <div className="library-footer">
        <span>
          <ShieldCheck size={14} />
          下载后的文章保存在本机
        </span>
        <span>
          好文章值得慢慢读。{" "}
          <span className="serif">
            Make room for a little more perspective.
          </span>
        </span>
      </div>
    </div>
  );
}
function Reader({
  article,
  settings,
  progress,
  update,
  notify,
  onSettings,
  onSaveWord,
  vocabulary,
}) {
  const [mode, setMode] = useState("reading"),
    [tab, setTab] = useState("chat"),
    [level, setLevel] = useState("托福"),
    [zoom, setZoom] = useState(progress.zoom || 100),
    [view, setView] = useState(progress.view || "pages"),
    [pageIndex, setPageIndex] = useState(progress.pageIndex || 0),
    [panning, setPanning] = useState(false),
    [selection, setSelection] = useState(""),
    [definition, setDefinition] = useState(null),
    [looking, setLooking] = useState(false);
  const modeRef = useRef(mode),
    lookupRef = useRef(0);
  modeRef.current = mode;
  const scrollRef = useRef(null),
    dragRef = useRef(null);
  const [pageWidth, setPageWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setPageWidth(Math.min(840, entry.contentRect.width)),
    );
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);
  const paragraphs = article.text
    .split(/\n\s*\n/)
    .filter((p) => p.trim() && p.trim() !== article.title.trim())
    .flatMap((p) =>
      wordCount(p) > 600 ? p.match(/\S+(?:\s+\S+){0,299}/g) : [p],
    );
  const pages = [];
  let current = [],
    words = 0;
  paragraphs.forEach((paragraph) => {
    if (words >= 350) {
      pages.push(current);
      current = [];
      words = 0;
    }
    current.push(paragraph);
    words += wordCount(paragraph);
  });
  if (current.length) pages.push(current);
  const activePage = Math.min(pageIndex, pages.length - 1);
  const turnPage = (index) => {
    const next = Math.max(0, Math.min(pages.length - 1, index));
    setPageIndex(next);
    update({ pageIndex: next });
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
    setSelection("");
    setDefinition(null);
  };
  const changeZoom = (value) => {
    const next = Math.max(70, Math.min(180, value));
    setZoom(next);
    update({ zoom: next });
  };
  useEffect(() => {
    if (scrollRef.current && view === "continuous")
      scrollRef.current.scrollTop = progress.scrollTop || 0;
  }, []);
  const scrollTimer = useRef(null);
  useEffect(() => () => clearTimeout(scrollTimer.current), []);
  const saveScroll = () => {
    if (view !== "continuous") return;
    const scrollTop = scrollRef.current?.scrollTop || 0;
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => update({ scrollTop }), 350);
  };
  const practice = progress.practices?.[level] || {};
  const updatePractice = (change) =>
    update((previous) => ({
      practices: {
        ...previous.practices,
        [level]: { ...previous.practices?.[level], ...change },
      },
    }));
  const selectWord = () => {
    if (mode !== "reading" || panning) return;
    const text = window.getSelection()?.toString().trim();
    if (text && /^[A-Za-z][A-Za-z ’'’-]{0,79}$/.test(text)) {
      lookupRef.current++;
      setDefinition(null);
      setSelection(text);
    } else setSelection("");
  };
  const lookup = async () => {
    const lookupId = ++lookupRef.current;
    setLooking(true);
    setDefinition(null);
    try {
      const result = await api.lookupWord({
        articleId: article.id,
        word: selection,
        mode,
      });
      if (modeRef.current === "reading" && lookupRef.current === lookupId)
        setDefinition(result);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setLooking(false);
    }
  };
  return (
    <div className="reader-layout">
      <section className="reading-pane">
        <div className="reader-toolbar">
          <div className="mode-switch">
            <button
              className={mode === "reading" ? "selected" : ""}
              onClick={() => setMode("reading")}
            >
              <BookOpen size={14} />
              阅读模式
            </button>
            <button
              className={mode === "practice" ? "selected" : ""}
              onClick={() => {
                setMode("practice");
                setTab("quiz");
                setSelection("");
                setDefinition(null);
              }}
            >
              <GraduationCap size={15} />
              练习模式
            </button>
          </div>
          <div className="font-controls">
            <IconButton
              icon={Move}
              label={panning ? "关闭平移" : "拖拽平移"}
              aria-pressed={panning}
              onClick={() => {
                setPanning(!panning);
                setSelection("");
                setDefinition(null);
              }}
            />
            <IconButton
              icon={ZoomOut}
              label="缩小"
              disabled={zoom <= 70}
              onClick={() => changeZoom(zoom - 10)}
            />
            <button onClick={() => changeZoom(100)} title="重置缩放">
              {zoom}%
            </button>
            <IconButton
              icon={ZoomIn}
              label="放大"
              disabled={zoom >= 180}
              onClick={() => changeZoom(zoom + 10)}
            />
          </div>
        </div>
        <div
          ref={scrollRef}
          className={cn("reading-scroll", panning && "panning")}
          tabIndex={0}
          aria-label="文章阅读区域"
          onScroll={saveScroll}
          onKeyDown={(e) => {
            if (
              view === "pages" &&
              (e.key === "ArrowRight" || e.key === "ArrowLeft")
            ) {
              e.preventDefault();
              turnPage(activePage + (e.key === "ArrowRight" ? 1 : -1));
            }
          }}
          onPointerDown={(e) => {
            if (!panning) return;
            e.preventDefault();
            dragRef.current = {
              x: e.clientX,
              y: e.clientY,
              left: e.currentTarget.scrollLeft,
              top: e.currentTarget.scrollTop,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const d = dragRef.current;
            e.currentTarget.scrollLeft = d.left - e.clientX + d.x;
            e.currentTarget.scrollTop = d.top - e.clientY + d.y;
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <article
            className="article-body"
            onMouseUp={selectWord}
            onKeyUp={selectWord}
            style={{
              "--reading-size": "19px",
              zoom: zoom / 100,
              width: pageWidth || "100%",
              maxWidth: "none",
            }}
          >
            <div className="eyebrow">{article.source}</div>
            <h1>{article.title}</h1>
            {article.subtitle && (
              <p className="article-subtitle">{article.subtitle}</p>
            )}
            <div className="article-metadata">
              <span>{wordCount(article.text)} WORDS</span>
              <span>{Math.ceil(wordCount(article.text) / 180)} MIN READ</span>
              <span>
                {mode === "reading"
                  ? "划词，读懂更多"
                  : "练习中 · 划词查询已禁用"}
              </span>
            </div>
            <div className="article-text">
              {(view === "pages" ? pages[activePage] : paragraphs).map(
                (p, i) => (
                  <p
                    className={i === 0 && wordCount(p) > 40 ? "drop-cap" : ""}
                    key={i}
                  >
                    {p}
                  </p>
                ),
              )}
            </div>
            {(view === "continuous" || activePage === pages.length - 1) && (
              <div className="article-end">
                ✳<span>END OF ARTICLE</span>
              </div>
            )}
          </article>
        </div>
        <div className="reading-pagination">
          <button
            className="text-button"
            onClick={() => {
              const next = view === "pages" ? "continuous" : "pages";
              setView(next);
              update({ view: next });
              scrollRef.current?.scrollTo({ top: 0, left: 0 });
            }}
          >
            {view === "pages" ? "切换连续阅读" : "切换分页阅读"}
          </button>
          {view === "pages" ? (
            <div>
              <IconButton
                icon={ChevronLeft}
                label="上一页"
                disabled={activePage === 0}
                onClick={() => turnPage(activePage - 1)}
              />
              <span>
                {activePage + 1} / {pages.length}
              </span>
              <IconButton
                icon={ChevronRight}
                label="下一页"
                disabled={activePage === pages.length - 1}
                onClick={() => turnPage(activePage + 1)}
              />
            </div>
          ) : (
            <span>连续阅读 · 滚动浏览</span>
          )}
          <span>
            {panning
              ? "拖拽平移已开启"
              : mode === "reading"
                ? "选词可查询"
                : "查词已禁用"}
          </span>
        </div>
        {mode === "reading" && (selection || definition) && (
          <div className="word-popover">
            <div className="section-title">
              <strong>{definition?.word || selection}</strong>
              <IconButton
                icon={X}
                label="关闭查词"
                onClick={() => {
                  setSelection("");
                  setDefinition(null);
                }}
              />
            </div>
            {definition ? (
              <>
                <span className="phonetic">{definition.phonetic}</span>
                <p>{definition.meaning}</p>
                <blockquote>{definition.example}</blockquote>
                <p className="muted">{definition.translation}</p>
                <button
                  className="button primary small"
                  onClick={() =>
                    onSaveWord(definition)
                      .then(() => notify("已加入生词本"))
                      .catch((e) => notify(e.message, true))
                  }
                >
                  <Bookmark size={14} />
                  {vocabulary.some((v) => v.word === definition.word)
                    ? "已收藏 · 更新释义"
                    : "加入生词本"}
                </button>
              </>
            ) : (
              <button
                className="button primary small"
                disabled={looking}
                onClick={lookup}
              >
                {looking ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                AI 查询释义
              </button>
            )}
          </div>
        )}
      </section>
      <aside className="study-pane">
        <div className="study-heading">
          <div className="assistant-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <h2>你的阅读搭子</h2>
            <span>READ. QUESTION. UNDERSTAND.</span>
          </div>
          <span className="online-dot" />
        </div>
        <div className="study-tabs">
          {[
            ["chat", "AI 追问"],
            ["quiz", "阅读理解"],
            ["writing", "概要写作"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "selected" : ""}
              onClick={() => {
                setTab(key);
                if (key !== "chat") {
                  setMode("practice");
                  setDefinition(null);
                  setSelection("");
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {!settings.hasApiKey && (
          <button className="key-notice" onClick={onSettings}>
            <LockKeyhole size={15} />
            <span>连接 ZenMux，开始 AI 学习</span>
            <ChevronRight size={15} />
          </button>
        )}
        {tab === "chat" ? (
          <Chat {...{ article, progress, update, notify, settings }} />
        ) : (
          <div className="practice-scroll">
            <div className="practice-intro">
              <span className="eyebrow">
                {tab === "quiz" ? "A LITTLE CHALLENGE" : "WRITE TO UNDERSTAND"}
              </span>
              <h3>
                {tab === "quiz"
                  ? "读懂了，来试试看。"
                  : "用自己的语言，再读一遍。"}
              </h3>
              <p>
                {tab === "quiz"
                  ? "每篇 5 题，从细节理解到观点推断。"
                  : "用 100–200 个英文词，概括文章的核心观点。"}
              </p>
            </div>
            <div className="level-picker">
              <span>难度</span>
              <div>
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    className={level === l ? "selected" : ""}
                    onClick={() => setLevel(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {tab === "quiz" ? (
              <Quiz
                key={"quiz" + level}
                {...{
                  article,
                  level,
                  practice,
                  updatePractice,
                  notify,
                  settings,
                }}
              />
            ) : (
              <Writing
                key={"write" + level}
                {...{
                  article,
                  level,
                  practice,
                  updatePractice,
                  notify,
                  settings,
                }}
              />
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
function Quiz({ article, level, practice, updatePractice, notify, settings }) {
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try {
      const quiz = await api.generateQuiz({ articleId: article.id, level });
      updatePractice({ quiz, answers: {}, submitted: false });
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  const answers = practice.answers || {},
    answered = Object.keys(answers).length;
  if (!practice.quiz)
    return (
      <div className="quiz-empty">
        <div className="exercise-illustration">
          <FileText size={48} strokeWidth={1} />
          <span>5</span>
        </div>
        <h4>为这篇文章，出一套好题</h4>
        <p>
          AI 根据原文与所选考试难度生成题目，
          <br />
          提交后查看答案与中文解析。
        </p>
        <button
          className="button primary"
          disabled={busy || !settings.hasApiKey}
          onClick={generate}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Sparkles size={16} />
          )}{" "}
          {busy ? "正在精心出题…" : "生成 5 道阅读题"}
        </button>
      </div>
    );
  return (
    <div className="quiz">
      <div className="quiz-status">
        <span>
          {practice.submitted
            ? `答对 ${practice.quiz.questions.filter((q, i) => answers[i] === q.answer).length} / 5`
            : `已作答 ${answered} / 5`}
        </span>
        <button className="text-button" disabled={busy} onClick={generate}>
          {busy ? "生成中…" : "重新出题"}
        </button>
      </div>
      {practice.quiz.questions.map((q, i) => (
        <div className="question" key={i}>
          <h4>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {q.question}
          </h4>
          <div className="options">
            {q.options.map((option, j) => (
              <button
                key={j}
                disabled={practice.submitted}
                className={cn(
                  answers[i] === j && "chosen",
                  practice.submitted && q.answer === j && "correct",
                  practice.submitted &&
                    answers[i] === j &&
                    q.answer !== j &&
                    "wrong",
                )}
                onClick={() =>
                  updatePractice({ answers: { ...answers, [i]: j } })
                }
              >
                <span>{"ABCD"[j]}</span>
                {option}
              </button>
            ))}
          </div>
          {practice.submitted && (
            <div className="explanation">
              <strong>答案 {"ABCD"[q.answer]} · 解析</strong>
              <p>{q.explanation}</p>
            </div>
          )}
        </div>
      ))}
      {!practice.submitted && (
        <button
          className="button primary full"
          disabled={answered !== 5}
          onClick={() => updatePractice({ submitted: true })}
        >
          提交答案
          <ArrowRight size={16} />
        </button>
      )}
      <p className="ai-footnote">
        由 {practice.quiz.model?.split("/").pop()} 出题并判题 ·
        每题附原文依据，请结合文章核对
      </p>
    </div>
  );
}
function Writing({
  article,
  level,
  practice,
  updatePractice,
  notify,
  settings,
}) {
  const [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false);
  const count = wordCount(practice.draft || "");
  const inputMode = practice.writingMode || "text";
  const photos = practice.writingImages || [];
  const signature = JSON.stringify({
    mode: inputMode,
    draft: inputMode === "text" ? practice.draft || "" : "",
    images: inputMode === "image" ? photos.map((p) => p.id) : [],
  });
  const append = (items) => {
    if (items.some((item) => item.type !== "image"))
      throw new Error("请上传手写作文的图片，支持 PNG、JPG、WEBP、GIF。");
    if (photos.length + items.length > 4)
      throw new Error("每份作文最多 4 张照片。");
    updatePractice({ writingImages: [...photos, ...items] });
  };
  const choose = async (paste = false) => {
    setAdding(true);
    try {
      append(await (paste ? api.pasteAttachments() : api.chooseImages()));
    } catch (e) {
      notify(e.message, true);
    } finally {
      setAdding(false);
    }
  };
  const addFiles = async (files) => {
    if (adding || busy) return;
    if (files.length + photos.length > 4) {
      notify("每份作文最多 4 张照片", true);
      return;
    }
    setAdding(true);
    try {
      const items = [];
      for (const file of files) {
        if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type))
          throw new Error("请上传图片格式的手写作文。");
        if (file.size > 10 * 1024 * 1024)
          throw new Error("每张作文照片最大 10 MB。");
        items.push(
          await api.addAttachment({
            name: file.name || "handwriting.png",
            bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
          }),
        );
      }
      append(items);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setAdding(false);
    }
  };
  const review = async () => {
    setBusy(true);
    try {
      const feedback = await api.reviewSummary({
        articleId: article.id,
        level,
        draft: practice.draft,
        inputMode,
        images: photos,
      });
      updatePractice({
        feedback,
        reviewedDraft: practice.draft,
        reviewedSignature: signature,
      });
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  const changed = practice.reviewedSignature
    ? practice.reviewedSignature !== signature
    : practice.reviewedDraft !== practice.draft;
  return (
    <div className="writing">
      <div className="writing-prompt">
        <span>YOUR WRITING PROMPT</span>
        <p>
          Summarize the central argument and the key supporting ideas. Use your
          own words and remain faithful to the original text.
        </p>
      </div>
      <div className="writing-source-tabs">
        <button
          className={inputMode === "text" ? "selected" : ""}
          disabled={busy}
          onClick={() => updatePractice({ writingMode: "text" })}
        >
          <Type size={14} />
          键盘输入
        </button>
        <button
          className={inputMode === "image" ? "selected" : ""}
          disabled={busy}
          onClick={() => updatePractice({ writingMode: "image" })}
        >
          <FileText size={14} />
          手写作文
        </button>
      </div>
      {inputMode === "text" ? (
        <>
          <label className="draft-label" htmlFor="draft">
            我的概要 <span>自动保存到本地</span>
          </label>
          <textarea
            id="draft"
            value={practice.draft || ""}
            onChange={(e) => updatePractice({ draft: e.target.value })}
            placeholder="The article explores…"
            maxLength={5000}
          />
          <div
            className={cn(
              "word-count",
              (count < 100 || count > 200) && "out-of-range",
            )}
          >
            <span>{count} / 100–200 words</span>
            <span>
              {count < 100
                ? `还需 ${100 - count} 词`
                : count > 200
                  ? `请减少 ${count - 200} 词`
                  : "词数符合要求"}
            </span>
          </div>
        </>
      ) : (
        <div
          className="handwriting-upload"
          tabIndex={0}
          aria-label="手写作文图片区域"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(Array.from(e.dataTransfer.files));
          }}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              addFiles(files);
            }
          }}
        >
          <div className="draft-label">
            学生手写作文 <span>{photos.length} / 4 张</span>
          </div>
          {photos.length ? (
            <div className="writing-photos">
              {photos.map((photo, index) => (
                <div key={photo.id}>
                  <small>第 {index + 1} 张</small>
                  <Attachment
                    file={photo}
                    onRemove={
                      !busy
                        ? () =>
                            updatePractice({
                              writingImages: photos.filter(
                                (p) => p.id !== photo.id,
                              ),
                            })
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="photo-empty">
              <FileText size={32} strokeWidth={1.2} />
              <p>把手写的思考，带到这里。</p>
              <span>
                上传清晰、完整的作文照片
                <br />
                支持拖入图片，或点击此处后粘贴
              </span>
            </div>
          )}
          <div className="photo-actions">
            <button
              className="button secondary small"
              disabled={adding || busy || photos.length >= 4}
              onClick={() => choose()}
            >
              {adding ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Plus size={14} />
              )}
              上传作文图片
            </button>
            <button
              className="button secondary small"
              disabled={adding || busy || photos.length >= 4}
              onClick={() => choose(true)}
            >
              <Clipboard size={14} />
              粘贴图片
            </button>
          </div>
          <p className="photo-note">
            按上传顺序识别 · 单张 ≤10 MB
            <br />
            先识别原稿，再按内容、结构、语言及词数评分。需要支持图片输入的模型。
          </p>
        </div>
      )}
      <button
        className="button primary full"
        disabled={
          busy ||
          adding ||
          !settings.hasApiKey ||
          (inputMode === "image" ? !photos.length : count < 100 || count > 200)
        }
        onClick={review}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Sparkles size={16} />
        )}{" "}
        {busy
          ? inputMode === "image"
            ? "正在识别手写内容并批阅…"
            : "正在批阅…"
          : inputMode === "image"
            ? "识别并批阅手写作文"
            : "获取 AI 写作反馈"}
      </button>
      {practice.feedback && (
        <div className="writing-feedback">
          {changed && (
            <p className="warning-note">
              提交内容已修改，以下反馈对应上一次提交。
            </p>
          )}
          <div className="score">
            <span>
              {practice.feedback.score}
              <small>/100</small>
            </span>
            <b>写作反馈</b>
            <CopyButton
              text={JSON.stringify(practice.feedback, null, 2)}
              notify={notify}
            />
          </div>
          {practice.feedback.criteria && (
            <div className="score-breakdown">
              {[
                ["content", "内容", 40],
                ["organization", "结构", 20],
                ["language", "语言", 30],
                ["length", "词数", 10],
              ].map(([key, label, max]) => (
                <div key={key}>
                  <span>{label}</span>
                  <strong>
                    {practice.feedback.criteria[key]}
                    <small>/{max}</small>
                  </strong>
                </div>
              ))}
            </div>
          )}
          {practice.feedback.transcription && (
            <div className="transcription">
              <div className="section-title">
                <h4>手写识别稿</h4>
                <CopyButton
                  text={practice.feedback.transcription}
                  notify={notify}
                />
              </div>
              <span className="transcription-count">
                {practice.feedback.recognizedWordCount} words · 目标 100–200 词
              </span>
              <p>{practice.feedback.transcription}</p>
              {practice.feedback.uncertainWords?.length > 0 && (
                <div className="warning-note">
                  以下字词识别不确定，请核对原图：
                  {practice.feedback.uncertainWords.join("、")}
                </div>
              )}
              <small>保留学生原有拼写和语法；请对照照片核对识别稿。</small>
            </div>
          )}
          <p>{practice.feedback.feedback}</p>
          <ul>
            {practice.feedback.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          <div className="section-title">
            <h4>参考概要</h4>
            <CopyButton text={practice.feedback.sample} notify={notify} />
          </div>
          <p className="sample-summary">{practice.feedback.sample}</p>
        </div>
      )}
    </div>
  );
}
function CopyButton({ text, notify }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-button"
      aria-label="复制内容"
      onClick={() =>
        api
          .copyText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
          .catch((e) => notify(e.message, true))
      }
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
      {copied ? "已复制" : "复制"}
    </button>
  );
}
function Chat({ article, progress, update, notify, settings }) {
  const [text, setText] = useState(""),
    [attachments, setAttachments] = useState([]),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false);
  const bottom = useRef(null);
  const messages = progress.chat || [];
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, busy]);
  const append = (items) =>
    setAttachments((previous) => {
      if (previous.length + items.length > 4) {
        notify("每条消息最多 4 个附件", true);
        return previous;
      }
      return [...previous, ...items];
    });
  const addFiles = async (files) => {
    if (files.length + attachments.length > 4) {
      notify("每条消息最多 4 个附件", true);
      return;
    }
    setAdding(true);
    try {
      const result = [];
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) throw new Error("每个附件最大 10 MB");
        result.push(
          await api.addAttachment({
            name: file.name || "clipboard.png",
            bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
          }),
        );
      }
      append(result);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setAdding(false);
    }
  };
  const choose = async () => {
    setAdding(true);
    try {
      append(await api.chooseAttachments());
    } catch (e) {
      notify(e.message, true);
    } finally {
      setAdding(false);
    }
  };
  const send = async () => {
    if (busy || (!text.trim() && !attachments.length)) return;
    const user = { role: "user", content: text.trim(), attachments };
    const next = [...messages, user];
    setBusy(true);
    try {
      const result = await api.chat({
        articleId: article.id,
        messages: next.slice(-30),
      });
      update({ chat: [...next, result] });
      setText("");
      setAttachments([]);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="chat-panel"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy) addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-flower">✳</div>
            <h3>好问题，是理解的开始。</h3>
            <p>
              关于这篇文章，随时问我。
              <br />
              可以追问观点、拆解长句，或一起讨论。
            </p>
            <div className="suggestions">
              {[
                "这篇文章的核心观点是什么？",
                "帮我梳理作者的论证逻辑",
                "挑出文中值得学习的表达",
              ].map((t) => (
                <button key={t} onClick={() => setText(t)}>
                  <MessageCircle size={14} />
                  {t}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
            <div className="context-note">
              <BookOpen size={15} />
              <span>已关联当前文章，提问无需重复粘贴正文</span>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-clear">
              <span>{messages.length / 2} 轮对话 · 已保存</span>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm("清空当前文章的 AI 对话？此操作无法撤销。")
                  )
                    update({ chat: [] });
                }}
              >
                清空对话
              </button>
            </div>
            {messages.map((m, i) => (
              <div className={cn("message", m.role)} key={i}>
                <div className="message-label">
                  {m.role === "user" ? "你" : "✳ FOLIO AI"}
                  {m.role === "assistant" && (
                    <CopyButton text={m.content} notify={notify} />
                  )}
                </div>
                {m.attachments?.length > 0 && (
                  <div className="attachment-list">
                    {m.attachments.map((a) => (
                      <Attachment key={a.id} file={a} />
                    ))}
                  </div>
                )}
                <div className={cn("message-content", m.role === "assistant" && "markdown-content")}>
                  {m.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml
                      components={{
                        img: ({ alt }) => <span>{alt || "图片"}</span>,
                        a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
                      }}
                    >{m.content}</ReactMarkdown>
                  ) : m.content}
                </div>
                {m.model && (
                  <small className="message-model">
                    {m.model.split("/").pop()}
                  </small>
                )}
              </div>
            ))}
          </>
        )}
        {busy && (
          <div className="thinking">
            <LoaderCircle className="spin" size={16} />
            正在阅读和思考…
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="chat-composer">
        {attachments.length > 0 && (
          <div className="attachment-list">
            {attachments.map((a) => (
              <Attachment
                key={a.id}
                file={a}
                onRemove={() =>
                  setAttachments(attachments.filter((item) => item.id !== a.id))
                }
              />
            ))}
          </div>
        )}
        <textarea
          aria-label="AI 追问内容"
          placeholder="写下你的问题，或粘贴一张图片…"
          value={text}
          disabled={busy}
          maxLength={10000}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              addFiles(files);
            }
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="composer-toolbar">
          <button
            className="attach-button"
            onClick={choose}
            disabled={adding || busy}
            title="上传图片、PDF、Word、Markdown"
          >
            {adding ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Paperclip size={16} />
            )}
            添加附件
          </button>
          <button
            className="attach-button"
            aria-label="粘贴附件"
            title="粘贴剪贴板中的图片或文件"
            disabled={adding || busy}
            onClick={async () => {
              setAdding(true);
              try {
                append(await api.pasteAttachments());
              } catch (e) {
                notify(e.message, true);
              } finally {
                setAdding(false);
              }
            }}
          >
            <Clipboard size={15} />
          </button>
          <span>Shift + Enter 换行</span>
          <button
            className="send-button"
            aria-label="发送消息"
            disabled={
              busy ||
              adding ||
              !settings.hasApiKey ||
              (!text.trim() && !attachments.length)
            }
            onClick={send}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <p className="chat-hint">
        图片 / PDF / DOCX / MD · 支持粘贴和拖入 · 单文件 ≤10 MB
      </p>
    </div>
  );
}
function Attachment({ file, onRemove }) {
  return (
    <div
      className={cn("attachment", file.type === "image" && "image-attachment")}
    >
      {file.thumbnail ? (
        <img src={file.thumbnail} alt={file.name} />
      ) : (
        <FileText size={19} />
      )}
      <span title={file.name}>{file.name}</span>
      {onRemove && (
        <button aria-label={"移除 " + file.name} onClick={onRemove}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}
function Empty({ icon: Icon, title, text }) {
  return (
    <div className="empty">
      <Icon size={32} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function HistoryPage({ library, progress, openArticle, notify, onDeleted }) {
  const [selected, setSelected] = useState([]),
    [format, setFormat] = useState("md"),
    [busy, setBusy] = useState(false);
  const records = library
    .filter((a) => progress[a.id])
    .sort((a, b) =>
      (progress[b.id].updatedAt || "").localeCompare(
        progress[a.id].updatedAt || "",
      ),
    );
  const remove = async () => {
    if (
      !window.confirm(
        `确定删除 ${selected.length} 条历史记录？答题、概要草稿和对话将被清除，下载的文章仍会保留。`,
      )
    )
      return;
    setBusy(true);
    try {
      onDeleted(await api.deleteHistory(selected));
      setSelected([]);
      notify("所选历史记录已删除");
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  const exportRecords = async () => {
    setBusy(true);
    try {
      const result = await api.exportHistory({ ids: selected, format });
      if (result) notify("历史记录已导出到 " + result);
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVERY PAGE LEAVES A TRACE</div>
          <h1>读过的，都算数。</h1>
          <p>你的阅读足迹、练习和思考，保存在这里。</p>
        </div>
        <div className="count-badge">
          {records.length}
          <span>篇阅读记录</span>
        </div>
      </div>
      <div className="history-toolbar">
        <label>
          <input
            type="checkbox"
            checked={!!records.length && selected.length === records.length}
            onChange={(e) =>
              setSelected(e.target.checked ? records.map((a) => a.id) : [])
            }
          />
          全选 <span>已选 {selected.length} 项</span>
        </label>
        <div>
          <select
            aria-label="导出格式"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="md">Markdown</option>
            <option value="json">JSON</option>
          </select>
          <button
            className="button secondary small"
            disabled={!selected.length || busy}
            onClick={exportRecords}
          >
            <Download size={15} />
            批量导出
          </button>
          <button
            className="button danger small"
            disabled={!selected.length || busy}
            onClick={remove}
          >
            <Trash2 size={15} />
            删除记录
          </button>
        </div>
      </div>
      <div className="history-list">
        {records.map((a) => {
          const p = progress[a.id];
          return (
            <div className="history-row" key={a.id}>
              <input
                aria-label={"选择 " + a.title}
                type="checkbox"
                checked={selected.includes(a.id)}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, a.id]
                      : selected.filter((id) => id !== a.id),
                  )
                }
              />
              <div className="history-icon">
                <BookOpen size={20} />
              </div>
              <div className="history-info">
                <h3>{a.title}</h3>
                <p>
                  {a.source} · {new Date(p.updatedAt).toLocaleString("zh-CN")}
                </p>
                <div className="record-tags">
                  {Object.entries(p.practices || {}).map(([level, item]) => (
                    <span key={level}>
                      {level}
                      {item.submitted
                        ? " · 已作答"
                        : item.feedback
                          ? " · 写作已批阅"
                          : item.writingImages?.length
                            ? " · 手写草稿"
                            : item.draft
                              ? " · 写作草稿"
                              : item.quiz
                                ? " · 已出题"
                                : " · 写作练习"}
                    </span>
                  ))}
                  {!!p.chat?.length && (
                    <span>{Math.floor(p.chat.length / 2)} 轮 AI 追问</span>
                  )}
                </div>
              </div>
              <button className="text-button" onClick={() => openArticle(a)}>
                继续阅读
                <ArrowRight size={16} />
              </button>
            </div>
          );
        })}
        {!records.length && (
          <Empty
            icon={History}
            title="第一篇，就从今天开始"
            text="打开文章后，阅读位置、练习与 AI 对话会自动保存在这里。"
          />
        )}
      </div>
      <p className="muted footnote">
        导出包含文章正文、练习答案、概要反馈和 AI
        对话；附件保留名称及图片缩略图（JSON）。
      </p>
    </div>
  );
}
function Vocabulary({ vocabulary, notify, onDelete }) {
  const [query, setQuery] = useState("");
  const items = vocabulary.filter((v) =>
    `${v.word} ${v.meaning}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORDS WORTH KEEPING</div>
          <h1>把陌生，变成熟悉。</h1>
          <p>在语境里遇见单词，在这里再次认识它。</p>
        </div>
        <label className="search-box">
          <Search size={16} />
          <input
            placeholder="搜索生词…"
            aria-label="搜索生词"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="vocabulary-grid">
        {items.map((v) => (
          <div className="vocabulary-card" key={v.word}>
            <div className="section-title">
              <h2>{v.word}</h2>
              <IconButton
                icon={Trash2}
                label={"删除 " + v.word}
                onClick={() =>
                  onDelete(v.word).catch((e) => notify(e.message, true))
                }
              />
            </div>
            <span className="phonetic">{v.phonetic}</span>
            <p>{v.meaning}</p>
            <blockquote>{v.example}</blockquote>
            <p className="muted">{v.translation}</p>
            <div className="word-source">
              <BookOpen size={13} />
              {v.articleTitle}
            </div>
          </div>
        ))}
      </div>
      {!items.length && (
        <Empty
          icon={Bookmark}
          title="收藏一个词，也收藏它的语境"
          text="在阅读模式选中英文单词，查询 AI 释义后加入生词本。练习模式不提供查词。"
        />
      )}
    </div>
  );
}
function SettingsPage({ settings, onSaved, notify }) {
  const [models, setModels] = useState(settings.models),
    [model, setModel] = useState(settings.model),
    [key, setKey] = useState(""),
    [newModel, setNewModel] = useState(""),
    [show, setShow] = useState(false),
    [removeKey, setRemoveKey] = useState(false),
    [revealedKey, setRevealedKey] = useState(""),
    [testing, setTesting] = useState(false),
    [connection, setConnection] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => { setConnection(null); }, [key, model, removeKey]);
  const toggleKey = async () => {
    if (show) { setShow(false); setRevealedKey(""); return; }
    try {
      if (!key && settings.hasApiKey && !removeKey)
        setRevealedKey(await api.revealKey());
      setShow(true);
    } catch (e) { notify(e.message, true); }
  };
  const testConnection = async () => {
    setTesting(true);
    setConnection(null);
    try {
      const result = await api.testConnection({ apiKey: key.trim(), model });
      setConnection({ ok: true, text: `连接成功 · ${result.model} · ${(result.milliseconds / 1000).toFixed(1)} 秒` });
    } catch (e) { setConnection({ ok: false, text: e.message }); }
    finally { setTesting(false); }
  };
  const addModel = () => {
    const value = newModel.trim();
    if (!/^[\w./:-]{1,120}$/.test(value)) {
      notify("请输入有效模型名称，例如 provider/model-name", true);
      return;
    }
    if (!models.includes(value)) setModels([...models, value]);
    setNewModel("");
  };
  const save = async () => {
    setBusy(true);
    try {
      onSaved(
        await api.saveSettings({
          apiKey: key.trim(),
          models,
          model,
          removeKey,
        }),
      );
      setKey("");
      setShow(false);
      setRevealedKey("");
      setRemoveKey(false);
      notify("设置已永久保存在本机");
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE IT YOUR OWN</div>
          <h1>为好奇心，接通电源。</h1>
          <p>连接你喜欢的模型，打造自己的阅读体验。</p>
        </div>
        <div className="settings-symbol">
          <Settings size={38} strokeWidth={1} />
        </div>
      </div>
      <section className="settings-card">
        <div className="settings-section-title">
          <div className="settings-icon">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h2>连接 ZenMux</h2>
            <p>一个 API Key，连接多个 AI 模型。</p>
          </div>
          <span
            className={cn(
              "connection-status",
              settings.hasApiKey && !removeKey && "ready",
            )}
          >
            {settings.hasApiKey && !removeKey ? "已配置密钥" : "尚未配置"}
          </span>
        </div>
        <label className="field-label" htmlFor="api-key">
          API KEY <span>仅在你的设备安全保存</span>
        </label>
        <div className="key-input">
          <input
            id="api-key"
            type={show ? "text" : "password"}
            value={key || (show ? revealedKey : "")}
            onChange={(e) => { setKey(e.target.value); setRevealedKey(""); }}
            autoComplete="off"
            spellCheck="false"
            placeholder={
              settings.hasApiKey && !removeKey
                ? "••••••••••••••••••••••••（已安全保存，留空保持）"
                : "输入你的 ZenMux API Key"
            }
          />
          <IconButton
            icon={show ? EyeOff : Eye}
            label={show ? "隐藏密钥" : "显示密钥"}
            onClick={toggleKey}
          />
        </div>
        <div className="connection-test">
          <button className="text-button" onClick={testConnection}
            disabled={testing || busy || removeKey || (!key.trim() && !settings.hasApiKey)}>
            {testing ? "正在测试…" : "测试连接"}
          </button>
          <p className="muted">验证当前密钥与所选模型；会发送一次简短请求，消耗少量额度。新输入的密钥测试后仍需保存。</p>
          {connection && <p role="status" className={connection.ok ? "connection-success" : "connection-error"}>{connection.text}</p>}
        </div>
        {settings.hasApiKey && (
          <label className="remove-key">
            <input
              type="checkbox"
              checked={removeKey}
              onChange={(e) => setRemoveKey(e.target.checked)}
            />
            保存时移除已有密钥
          </label>
        )}
        <div className="invite-card">
          <span>订阅用户请使用 sk-ss-v1- 开头的完整订阅 API Key。</span>
          <button
            onClick={() => api.openExternal("https://zenmux.ai/platform/subscription")}
          >
            获取订阅密钥 <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="invite-card">
          <span>还没有 API Key？</span>
          <button
            onClick={() => api.openExternal("https://zenmux.ai/invite/GBQMC5")}
          >
            通过邀请链接开通 ZenMux <ArrowUpRight size={14} />
          </button>
        </div>
        <label className="field-label">BASE URL</label>
        <div className="readonly-field">
          https://zenmux.ai/api/v1
          <LockKeyhole size={14} />
        </div>
        <div className="security-note">
          <ShieldCheck size={16} />
          <p>
            API Key
            通过系统安全存储加密，默认隐藏；点击眼睛可查看，离开设置后隐藏。模型请求由桌面主进程发送，文章与所选附件仅在调用
            AI 时传给 ZenMux。
            {!settings.secureStorage && " 当前环境没有可用的系统安全存储。"}
          </p>
        </div>
      </section>
      <section className="settings-card">
        <div className="settings-section-title">
          <div className="settings-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h2>选择你的阅读搭子</h2>
            <p>设置默认模型，或添加 ZenMux 支持的模型名称。</p>
          </div>
        </div>
        <div className="model-list">
          {models.map((m) => (
            <div
              className={cn("model-option", model === m && "selected")}
              key={m}
            >
              <label>
                <input
                  type="radio"
                  name="model"
                  checked={model === m}
                  onChange={() => setModel(m)}
                />
                <span>
                  <strong>{m.split("/").pop()}</strong>
                  <small>{m}</small>
                </span>
              </label>
              {model === m ? (
                <span className="default-badge">当前默认</span>
              ) : (
                <IconButton
                  icon={Trash2}
                  label={"移除 " + m}
                  onClick={() => setModels(models.filter((item) => item !== m))}
                />
              )}
            </div>
          ))}
        </div>
        <div className="add-model">
          <input
            aria-label="新增模型名称"
            placeholder="provider/model-name"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addModel();
            }}
          />
          <button className="button secondary" onClick={addModel}>
            <Plus size={16} />
            添加模型
          </button>
        </div>
        <p className="muted">
          图片附件需要模型支持视觉输入。PDF / Word / MD 会提取文字后发送。
        </p>
      </section>
      <div className="settings-actions">
        <span>
          <ShieldCheck size={14} />
          设置关闭应用后仍会保留
        </span>
        <button className="button primary" disabled={busy} onClick={save}>
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}
          保存设置
        </button>
      </div>
    </div>
  );
}
function DownloadProgress({ transfer }) {
  const { stage, receivedBytes, totalBytes, bytesPerSecond } = transfer;
  const formatBytes = (bytes) =>
    bytes >= 1024 * 1024
      ? (bytes / 1024 / 1024).toFixed(1) + " MB"
      : (bytes / 1024).toFixed(1) + " KB";
  const percent =
    stage === "parsing"
      ? 100
      : totalBytes
        ? Math.min(99, Math.floor((receivedBytes / totalBytes) * 100))
        : null;
  return (
    <div className="download-progress" aria-label="下载进度">
      <div className="download-progress-heading">
        <span>
          <LoaderCircle className="spin" size={14} />
          {stage === "connecting"
            ? "正在连接…"
            : stage === "parsing"
              ? "下载完成，正在解析文章…"
              : "正在下载"}
        </span>
        <strong>{percent === null ? "大小未知" : percent + "%"}</strong>
      </div>
      <progress
        max="100"
        value={percent ?? undefined}
        aria-label="刊物下载进度"
      />
      <div className="download-progress-details">
        <span>
          {formatBytes(receivedBytes)} /{" "}
          {totalBytes ? formatBytes(totalBytes) : "总大小未知"}
        </span>
        <span>
          {stage === "downloading"
            ? formatBytes(bytesPerSecond) + "/s"
            : stage === "parsing"
              ? "正在整理到书架"
              : "等待传输"}
        </span>
      </div>
    </div>
  );
}
function Catalog({ publication, library, notify, onImported }) {
  const [path, setPath] = useState(publication.path),
    [items, setItems] = useState([]),
    [busy, setBusy] = useState(false),
    [downloading, setDownloading] = useState(""),
    [transfer, setTransfer] = useState(null),
    [error, setError] = useState(""),
    [cached, setCached] = useState(false);
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.listRepo(path);
      setItems(data.items);
      setCached(data.cached);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load();
  }, [path]);
  const download = async (item) => {
    setDownloading(item.path);
    setTransfer({
      stage: "connecting",
      receivedBytes: 0,
      totalBytes: item.size || null,
      bytesPerSecond: 0,
    });
    try {
      onImported(await api.importRepo(item.path, setTransfer));
    } catch (e) {
      notify(e.message, true);
    } finally {
      setDownloading("");
      setTransfer(null);
    }
  };
  return (
    <>
      <div className="eyebrow">EXPLORE THE ARCHIVE</div>
      <h2 className="modal-title">{publication.name}</h2>
      <p className="muted">先下载，后阅读。下载后的刊物会永久保存在本机。</p>
      <div className="catalog-path">
        <button
          className="text-button"
          disabled={path === publication.path || busy || !!downloading}
          onClick={() => setPath(path.split("/").slice(0, -1).join("/"))}
        >
          <ChevronLeft size={16} />
          上一级
        </button>
        <span>{path.split("/").slice(1).join(" / ") || "全部期刊"}</span>
        <IconButton
          icon={RefreshCw}
          label="刷新目录"
          disabled={busy || !!downloading}
          onClick={load}
        />
      </div>
      {cached && (
        <p className="warning-note">网络不可用，正在显示上次缓存的目录。</p>
      )}
      {busy ? (
        <div className="empty">
          <LoaderCircle className="spin" />
          正在读取 GitHub 目录…
        </div>
      ) : error ? (
        <div className="empty">
          <AlertCircle />
          <p>{error}</p>
          <button className="button secondary" onClick={load}>
            重试
          </button>
        </div>
      ) : (
        <div className="catalog-list">
          {items.map((item) => {
            const date = item.name.match(/\d{4}\.\d{2}\.\d{2}/)?.[0];
            const downloaded = library.some(
              (a) =>
                a.publicationId === item.path ||
                a.publicationId === item.path.split("/").slice(0, -1).join("/"),
            );
            return (
              <button
                className="catalog-item"
                key={item.path}
                disabled={!!downloading}
                onClick={() =>
                  item.type === "dir" ? setPath(item.path) : download(item)
                }
              >
                {item.type === "dir" ? (
                  <FolderOpen size={21} />
                ) : (
                  <FileText size={21} />
                )}
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.type === "dir"
                      ? downloaded
                        ? "已下载 · 点击查看"
                        : "查看刊物文件"
                      : `${item.name.split(".").pop().toUpperCase()} · ${(item.size / 1024 / 1024).toFixed(1)} MB`}
                  </small>
                </span>
                {downloading === item.path ? (
                  <LoaderCircle className="spin" size={17} />
                ) : item.type === "dir" ? (
                  <ChevronRight size={17} />
                ) : (
                  <Download size={17} />
                )}
              </button>
            );
          })}
          {!items.length && (
            <p className="muted">当前目录没有 EPUB、MOBI、PDF 文件或子目录。</p>
          )}
        </div>
      )}
      {downloading && transfer && <DownloadProgress transfer={transfer} />}
      <div className="catalog-note">
        {downloading
          ? "正在下载并解析文章，请稍候…"
          : "来源：hehonghui/awesome-english-ebooks · 保留原出版信息"}
      </div>
    </>
  );
}
function PasteArticle({ notify, onImported }) {
  const [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="eyebrow">BRING YOUR OWN WORDS</div>
      <h2 className="modal-title">添加一篇好文章</h2>
      <label className="field-label" htmlFor="article-title">
        文章标题
      </label>
      <input
        className="full-input"
        id="article-title"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="给文章一个标题"
      />
      <label className="field-label" htmlFor="article-text">
        英文正文
      </label>
      <textarea
        className="paste-text"
        id="article-text"
        value={text}
        maxLength={200000}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴英文正文，至少 50 个英文词…"
      />
      <div className="modal-actions">
        <span className="muted">{wordCount(text)} words</span>
        <button
          className="button primary"
          disabled={busy || !title.trim() || wordCount(text) < 50}
          onClick={async () => {
            setBusy(true);
            try {
              onImported(await api.addArticle({ title, text }));
            } catch (e) {
              notify(e.message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          保存到书架
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
function PdfArticle({ pdf, notify, onImported }) {
  const [start, setStart] = useState(1),
    [end, setEnd] = useState(1),
    [title, setTitle] = useState(""),
    [text, setText] = useState(pdf.pages[0] || ""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setText(pdf.pages.slice(start - 1, end).join("\n\n"));
  }, [start, end]);
  return (
    <>
      <div className="eyebrow">ONE ARTICLE AT A TIME</div>
      <h2 className="modal-title">从 PDF 摘选一篇文章</h2>
      <p className="muted">
        {pdf.name} · 共 {pdf.pages.length}{" "}
        页。选择文章所在页码，可在下方删去其他文章的文字。多栏 PDF
        请核对阅读顺序。
      </p>
      <div className="pdf-range">
        <label>
          起始页
          <input
            type="number"
            min="1"
            max={pdf.pages.length}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
          />
        </label>
        <label>
          结束页
          <input
            type="number"
            min={start}
            max={pdf.pages.length}
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="field-label" htmlFor="pdf-title">
        文章标题
      </label>
      <input
        className="full-input"
        id="pdf-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="输入这篇文章的标题"
        maxLength={200}
      />
      <label className="field-label" htmlFor="pdf-text">
        文章正文 · 可编辑整理
      </label>
      <textarea
        className="paste-text"
        id="pdf-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="modal-actions">
        <span className="muted">{wordCount(text)} words</span>
        <button
          className="button primary"
          disabled={
            busy ||
            !title.trim() ||
            wordCount(text) < 50 ||
            start < 1 ||
            end < start ||
            end > pdf.pages.length
          }
          onClick={async () => {
            setBusy(true);
            try {
              onImported(
                await api.createPdfArticle({
                  documentId: pdf.id,
                  start,
                  end,
                  title,
                  text,
                }),
              );
              setTitle("");
              notify("已加入书架，可以继续摘选其他文章或关闭窗口");
            } catch (e) {
              notify(e.message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          保存为独立文章
          <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
