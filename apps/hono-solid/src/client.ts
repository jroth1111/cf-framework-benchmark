import "./main.css";

const route = document.body.dataset.route;

const entryLoaders: Record<string, () => Promise<unknown>> = {
  home: () => import("./entries/home"),
  stays: () => import("./entries/stays"),
  stay: () => import("./entries/stay"),
  blog: () => import("./entries/blog"),
  post: () => import("./entries/post"),
  chart: () => import("./entries/chart"),
  media: () => import("./entries/media"),
};

const load = route ? entryLoaders[route] : null;

if (load) {
  void load();
}
