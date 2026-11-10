// The toast is inside the fullscreen element, which lives above the normal page.
export function showRemoteToastCustom(
  message: string,
  playerHost?: Element
): () => void {
  const toast = document.createElement("div");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    top: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    background: "rgba(20, 110, 60, 0.95)",
    color: "white",
    padding: "12px 20px",
    borderRadius: "8px",
    fontSize: "18px",
    fontFamily: "sans-serif",
    pointerEvents: "none",
    maxWidth: "90vw",
  });
  const attach = () =>
    (document.fullscreenElement ?? playerHost ?? document.body).appendChild(
      toast
    );
  attach();
  document.addEventListener("fullscreenchange", attach);
  let timer: number;
  const clear = () => {
    window.clearTimeout(timer);
    document.removeEventListener("fullscreenchange", attach);
    toast.remove();
  };
  timer = window.setTimeout(clear, 1000);
  return clear;
}
