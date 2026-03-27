import { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import LoginModal from "../components/LoginModal";

const FRAME_COUNT = 180;
const REVEAL_FRAME = 140;
const FRAME_PREFIX = "/frames/ezgif-frame-";
const FRAME_EXTENSION = ".png";
const TAGLINE_TEXT = "// Systems online - Access gated";
const WATERMARK_MASK_BG =
  "radial-gradient(circle at bottom left, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.86) 46%, rgba(0,0,0,0) 100%)";

gsap.registerPlugin(ScrollTrigger);

const getFrameSrc = (index) =>
  `${FRAME_PREFIX}${String(index).padStart(3, "0")}${FRAME_EXTENSION}`;

const clampFrame = (value) => Math.min(FRAME_COUNT, Math.max(1, value));

function TypewriterText({ text, startDelay = 1950 }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    let intervalId;
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        if (i <= text.length) {
          setDisplayed(text.slice(0, i));
          i += 1;
        } else {
          clearInterval(intervalId);
        }
      }, 38);
    }, startDelay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, startDelay]);

  return (
    <p
      className="cv-tagline-anim mt-4 font-mono text-sm"
      style={{ color: "rgba(34,211,180,0.82)" }}
    >
      {displayed}
      <span className="cv-cursor" />
    </p>
  );
}

export default function LandingPage() {
  const canvasRef = useRef(null);
  const scrollerRef = useRef(null);
  const wrapperRef = useRef(null);
  const imagesRef = useRef(new Array(FRAME_COUNT + 1));
  const currentFrameRef = useRef(1);
  const [displayFrame, setDisplayFrame] = useState(1);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const displayFrameRef = useRef(1);
  const [animKey, setAnimKey] = useState(0);

  const revealActive = useMemo(() => displayFrame >= REVEAL_FRAME, [displayFrame]);
  const hasStartedScroll = useMemo(() => displayFrame > 1, [displayFrame]);
  const animationComplete = useMemo(() => displayFrame >= FRAME_COUNT, [displayFrame]);

  const prevReveal = useRef(false);
  useEffect(() => {
    if (revealActive && !prevReveal.current) {
      setAnimKey((k) => k + 1);
    }
    prevReveal.current = revealActive;
  }, [revealActive]);

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
      if (Math.round(currentFrameRef.current) === index) renderFrame(index);
    };
  };

  const preloadNeighbors = (frameIndex) => {
    for (let offset = -3; offset <= 3; offset += 1) loadFrame(frameIndex + offset);
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !scroller || !wrapper) return undefined;

    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      renderFrame(Math.round(currentFrameRef.current));
    };

    const handleKeyDown = (event) => {
      const { key } = event;
      const isDown = key === "ArrowDown" || key === "PageDown" || key === " ";
      const isUp = key === "ArrowUp" || key === "PageUp";
      if (!isDown && !isUp) return;
      event.preventDefault();
      scroller.scrollBy({ top: isDown ? 90 : -90, behavior: "smooth" });
    };

    handleResize();
    loadFrame(1);
    scroller.focus({ preventScroll: true });
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
          scrub: 0.9,
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
        },
      });
    }, scroller);

    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      ctx.revert();
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
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
              <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/70" />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 z-10"
                style={{
                  width: "clamp(170px, 22vw, 300px)",
                  height: "clamp(72px, 13vh, 150px)",
                  background: WATERMARK_MASK_BG,
                }}
              />

              <div className="absolute inset-0 flex flex-col">
                <header className="flex items-center justify-start px-6 py-6 md:px-12">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
                    <div className="font-mono text-[10px] uppercase tracking-[0.55em] text-fuchsia-200/80">
                      CodeVerse
                    </div>
                  </div>
                </header>

                <div className="flex flex-1 items-center px-6 md:px-12">
                  {revealActive && (
                    <div key={animKey} className="max-w-2xl">
                      <div className="relative inline-block leading-none">
                        <span
                          aria-hidden="true"
                          className="cv-glitch-r absolute inset-0 select-none"
                          style={{
                            fontFamily: '"Righteous", cursive',
                            fontSize: "clamp(4rem, 13vw, 6.75rem)",
                            fontWeight: 400,
                            color: "#f43f5e",
                            whiteSpace: "nowrap",
                            lineHeight: 1,
                          }}
                        >
                          CodeVerse
                        </span>
                        <span
                          aria-hidden="true"
                          className="cv-glitch-b absolute inset-0 select-none"
                          style={{
                            fontFamily: '"Righteous", cursive',
                            fontSize: "clamp(4rem, 13vw, 6.75rem)",
                            fontWeight: 400,
                            color: "#22d3ee",
                            whiteSpace: "nowrap",
                            lineHeight: 1,
                          }}
                        >
                          CodeVerse
                        </span>
                        <h1
                          className="cv-title-anim cv-scanline-mask"
                          style={{
                            fontFamily: '"Righteous", cursive',
                            fontSize: "clamp(4rem, 13vw, 6.75rem)",
                            fontWeight: 400,
                            color: "#d966ff",
                            whiteSpace: "nowrap",
                            lineHeight: 1,
                            letterSpacing: "0.01em",
                          }}
                        >
                          CodeVerse
                        </h1>
                      </div>

                      <p
                        className="cv-sub-anim mt-4 font-mono text-xs uppercase tracking-[0.52em]"
                        style={{ color: "rgba(180,120,255,0.75)" }}
                      >
                        Enter the Arena
                      </p>

                      <TypewriterText text={TAGLINE_TEXT} startDelay={1950} />

                      {animationComplete && (
                        <button
                          type="button"
                          onClick={() => setIsLoginOpen(true)}
                          className="cv-spiderverse-button pointer-events-auto mt-8"
                        >
                          <span className="cv-spiderverse-label">Login</span>
                          <span className="cv-spiderverse-glitch-layers" aria-hidden="true">
                            <span className="cv-spiderverse-glitch-layer cv-spiderverse-layer-1">
                              Login
                            </span>
                            <span className="cv-spiderverse-glitch-layer cv-spiderverse-layer-2">
                              Login
                            </span>
                          </span>
                          <span className="cv-spiderverse-noise" aria-hidden="true" />
                          <span className="cv-spiderverse-glitch-slice" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-6 pb-10 text-left text-xs text-muted md:px-12">
                  Scroll to explore the arena sequence.
                </div>
              </div>

              {!hasStartedScroll && (
                <div className="pointer-events-none absolute inset-x-0 bottom-12 z-20 flex justify-center px-6">
                  <div className="text-center">
                    <p className="font-mono text-xs uppercase tracking-[0.45em] text-amber-100/85">
                      Scroll to Explore
                    </p>
                    <div className="mx-auto mt-4 flex h-14 w-9 items-start justify-center rounded-full border-2 border-amber-100/65 p-1.5">
                      <span className="mt-0.5 h-2.5 w-1.5 rounded-full bg-amber-100/80 animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              <div className="pointer-events-none absolute bottom-10 right-6 font-mono text-xs text-fuchsia-200/60 md:right-12">
                {String(displayFrame).padStart(3, "0")} / {FRAME_COUNT}
              </div>
            </div>
          </div>
        </div>
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}