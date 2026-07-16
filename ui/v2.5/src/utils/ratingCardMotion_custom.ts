const premiumRatingCardSelectorCustom = ".rating-card-theme-premium";
const pausedRatingCardClassCustom = "rating-card-motion-paused";
const premiumRatingTierClassesCustom = [
  "rating-3-stars",
  "rating-4-stars",
  "rating-5-stars",
  "rating-royal-sapphire",
] as const;

export function isPremiumRatingCardMotionTargetCustom(className: string) {
  const classes = new Set(className.split(/\s+/).filter(Boolean));

  return (
    classes.has("rating-card-theme-premium") &&
    premiumRatingTierClassesCustom.some((tier) => classes.has(tier))
  );
}

export function installRatingCardMotionObserverCustom() {
  if (
    typeof document === "undefined" ||
    typeof window === "undefined" ||
    !("IntersectionObserver" in window) ||
    !("MutationObserver" in window)
  ) {
    return () => {};
  }

  const root = document.getElementById("root") ?? document.body;
  const observedCards = new Set<Element>();
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle(
          pausedRatingCardClassCustom,
          !entry.isIntersecting
        );
      });
    },
    { rootMargin: "160px 0px" }
  );

  function syncCard(element: Element) {
    const isTarget = isPremiumRatingCardMotionTargetCustom(
      element.getAttribute("class") ?? ""
    );

    if (isTarget && !observedCards.has(element)) {
      observedCards.add(element);
      intersectionObserver.observe(element);
    } else if (!isTarget && observedCards.delete(element)) {
      intersectionObserver.unobserve(element);
      element.classList.remove(pausedRatingCardClassCustom);
    }
  }

  function syncTree(node: Node) {
    if (!(node instanceof Element)) return;

    syncCard(node);
    node.querySelectorAll(premiumRatingCardSelectorCustom).forEach(syncCard);
  }

  function unobserveTree(node: Node) {
    if (!(node instanceof Element)) return;

    [node, ...node.querySelectorAll(premiumRatingCardSelectorCustom)].forEach(
      (element) => {
        if (observedCards.delete(element)) {
          intersectionObserver.unobserve(element);
        }
      }
    );
  }

  syncTree(root);

  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes") {
        syncCard(mutation.target as Element);
        return;
      }

      mutation.addedNodes.forEach(syncTree);
      mutation.removedNodes.forEach(unobserveTree);
    });
  });

  mutationObserver.observe(root, {
    attributeFilter: ["class"],
    attributes: true,
    childList: true,
    subtree: true,
  });

  return () => {
    mutationObserver.disconnect();
    intersectionObserver.disconnect();
    observedCards.forEach((card) =>
      card.classList.remove(pausedRatingCardClassCustom)
    );
    observedCards.clear();
  };
}
