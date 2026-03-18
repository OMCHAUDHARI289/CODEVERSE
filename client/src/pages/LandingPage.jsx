import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const FRAME_COUNT = 180;
const REVEAL_FRAME = 130;
const FRAME_PREFIX = "/frames/ezgif-frame-";
const FRAME_EXTENSION = ".png";

gsap.registerPlugin(ScrollTrigger);

const getFrameSrc = (index) =>
  `${FRAME_PREFIX}${String(index).padStart(3, "0")}${FRAME_EXTENSION}`;

const clampFrame = (value) => Math.min(FRAME_COUNT, Math.max(1, value));

export default function LandingPage() {
  const canvasRef = useRef(null);
  const scrollerRef = useRef(null);
  const wrapperRef = useRef(null);
  const imagesRef = useRef(new Array(FRAME_COUNT + 1));
  const currentFrameRef = useRef(1);
  const [displayFrame, setDisplayFrame] = useState(1);
  const displayFrameRef = useRef(1);

  const revealActive = useMemo(
    () => displayFrame >= REVEAL_FRAME,
    [displayFrame]
  );

  const renderFrame = (frameIndex) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    const image = imagesRef.current[frameIndex];
    if (!image || !image.complete) return;

    const { width, height } = canvas;
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    context.clearRect(0, 0, width, height);
    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  };

  const loadFrame = (frameIndex) => {
    const index = clampFrame(frameIndex);
    if (imagesRef.current[index]) return;

    const image = new Image();
    image.src = getFrameSrc(index);
    imagesRef.current[index] = image;

    image.onload = () => {
      if (Math.round(currentFrameRef.current) === index) {
        renderFrame(index);
      }
    };
  };

  const preloadNeighbors = (frameIndex) => {
    for (let offset = -3; offset <= 3; offset += 1) {
      loadFrame(frameIndex + offset);
    }
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas) return undefined;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      renderFrame(Math.round(currentFrameRef.current));
    };

    handleResize();
    loadFrame(1);
    const handleKeyDown = (event) => {
      if (!scroller) return;

      const { key } = event;
      const isDown = key === "ArrowDown" || key === "PageDown" || key === " ";
      const isUp = key === "ArrowUp" || key === "PageUp";

      if (!isDown && !isUp) return;

      event.preventDefault();
      const delta = isDown ? 90 : -90;
      scroller.scrollBy({ top: delta, behavior: "smooth" });
    };

    scroller?.focus({ preventScroll: true });
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown, { passive: false });

    const frameState = { value: 1 };

    const ctx = gsap.context(() => {
      gsap.to(frameState, {
        value: FRAME_COUNT,
        ease: "none",
        scrollTrigger: {
          trigger: wrapper,
          scroller,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.9
        },
        onUpdate: () => {
          const frameIndex = clampFrame(Math.round(frameState.value));
          currentFrameRef.current = frameState.value;
          preloadNeighbors(frameIndex);
          renderFrame(frameIndex);

          if (frameIndex !== displayFrameRef.current) {
            displayFrameRef.current = frameIndex;
            setDisplayFrame(frameIndex);
          }
        }
      });

    }, scroller);

    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      ctx.revert();
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <div className="relative h-screen">
      <div
        ref={scrollerRef}
        className="no-scrollbar h-screen w-full overflow-y-scroll scroll-smooth"
        tabIndex={0}
        aria-label="Scroll to explore CodeVerse"
      >
        <div
          ref={wrapperRef}
          style={{ height: `${FRAME_COUNT * 12}px` }}
          className="relative"
        >
          <div className="sticky top-0 h-screen w-full">
            <div className="relative h-full w-full">
              <canvas
                ref={canvasRef}
                className="h-full w-full"
                aria-hidden="true"
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/70" />

              <div className="absolute inset-0 flex flex-col">
                <header className="flex items-center justify-between px-6 py-6 md:px-12">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-400 shadow-glow" />
                    <div className="font-mono text-[10px] uppercase tracking-[0.55em] text-fuchsia-200/80">
                      CodeVerse
                    </div>
                  </div>
                  <Link
                    to="/login"
                    className="pointer-events-auto rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-ink backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
                  >
                    Login
                  </Link>
                </header>

                <div className="flex flex-1 items-center px-6 md:px-12">
                  <div
                    className={`max-w-2xl transition duration-700 ${
                      revealActive
                        ? "translate-y-0 opacity-100"
                        : "translate-y-4 opacity-0"
                    }`}
                  >
                    <h1
                      className="glitch text-5xl font-semibold text-transparent bg-gradient-to-r from-fuchsia-400 via-purple-400 to-violet-300 bg-clip-text sm:text-7xl lg:text-8xl"
                      data-text="CodeVerse"
                    >
                      CodeVerse
                    </h1>
                    <p className="mt-3 font-mono text-xs uppercase tracking-[0.6em] text-fuchsia-200/80">
                      Enter the Arena
                    </p>
                    <p className="mt-5 max-w-lg text-base text-muted sm:text-lg">
                      Frame 130 unlocks the arena sequence. Scroll to sync.
                    </p>
                    <div className="mt-7 flex items-center gap-4 text-xs text-muted">
                      <span className="h-px w-16 bg-gradient-to-r from-fuchsia-400 to-violet-300" />
                      <span>Systems online · Access gated</span>
                    </div>
                  </div>
                </div>

                <div className="pb-10 px-6 text-left text-xs text-muted md:px-12">
                  Scroll to explore the arena sequence.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
