import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { OnboardingProvider } from "@/lib/onboarding/OnboardingContext";
import { StageModals } from "@/components/oventric/onboarding/StageModals";
import { AuthSeeder } from "@/components/oventric/AuthSeeder";
import { AuthGateProvider } from "@/lib/auth-gate/AuthGateProvider";

import { ProfileSetupModalHost } from "@/lib/onboarding/ProfileSetupModal";
import { KycGateProvider } from "@/lib/kyc-gate/KycGate";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ReactivationGate } from "@/components/oventric/ReactivationGate";
import { GlobalMobileNav } from "@/components/oventric/GlobalMobileNav";
import { Toaster } from "@/components/ui/sonner";
import { BootSplash } from "@/components/oventric/BootSplash";
import { useLiveFx } from "@/lib/useLiveFx";
import { FeatureCarousel } from "@/components/oventric/FeatureCarousel";
import { useFirstLaunch } from "@/hooks/useFirstLaunch";
import { unlockNotificationSound } from "@/lib/notification-sound";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#121214" },
      { name: "color-scheme", content: "dark" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "Oventric — The multi-vendor tech platform" },
      { name: "description", content: "Feed, marketplace, academy, bounties, and wallet — one platform for builders." },
      { property: "og:title", content: "Oventric — The multi-vendor tech platform" },
      { property: "og:description", content: "Feed, marketplace, academy, bounties, and wallet — one platform for builders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Oventric — The multi-vendor tech platform" },
      { name: "twitter:description", content: "Feed, marketplace, academy, bounties, and wallet — one platform for builders." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/05d19baa-9b14-438f-9504-d1be93993980/id-preview-e406e368--edfe3718-716a-4c70-9e5e-216fbc715fe1.lovable.app-1783530099744.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/05d19baa-9b14-438f-9504-d1be93993980/id-preview-e406e368--edfe3718-716a-4c70-9e5e-216fbc715fe1.lovable.app-1783530099744.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/__l5e/assets-v1/efd2d190-0a3e-4566-a925-8631c270ad3a/oventric-mark.jpg", type: "image/jpeg" },
      { rel: "apple-touch-icon", href: "/__l5e/assets-v1/efd2d190-0a3e-4566-a925-8631c270ad3a/oventric-mark.jpg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ background: "#121214", colorScheme: "dark" }}>
      <head>
        <HeadContent />
        <script
          // Pre-paint GPU tier detection. Sets `html.high-gpu` for capable
          // devices (allow-list) or `html.low-gpu` for weak GPUs / reduced-motion.
          // Neither = safe UI default. Manual override:
          // localStorage['oventric:gpu-mode'] = 'high' | 'low'.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  var d=document.documentElement;
  function markLow(r){d.classList.remove('high-gpu');d.classList.add('low-gpu');try{d.dataset.gpuTier='low';d.dataset.gpuReason=r||'';}catch(e){}}
  function markHigh(r){d.classList.remove('low-gpu');d.classList.add('high-gpu');try{d.dataset.gpuTier='high';d.dataset.gpuReason=r||'';}catch(e){}}
  var ov=null;try{ov=localStorage.getItem('oventric:gpu-mode');}catch(e){}
  if(ov==='low'){markLow('manual');return;}
  if(ov==='high'){markHigh('manual');return;}
  var reduce=false;try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
  if(reduce){markLow('reduced-motion');return;}
  var ua=navigator.userAgent||'';
  var isMobile=/Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  var isAndroid=/Android/i.test(ua);
  var isApple=/iPhone|iPad|iPod/i.test(ua);
  var weakDevice=/Infinix|X6813|X68\\d{2}|Note\\s*11i|TECNO|itel|Nokia\\s*C|Redmi\\s*(9|A)|Realme\\s*C/i.test(ua);
  var mem=navigator.deviceMemory||0;
  var cpu=navigator.hardwareConcurrency||0;
  var r='';
  try{
    var c=document.createElement('canvas');
    var gl=c.getContext('webgl')||c.getContext('experimental-webgl');
    if(gl){
      var ext=gl.getExtension('WEBGL_debug_renderer_info');
      r=ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)||''):String(gl.getParameter(gl.RENDERER)||'');
    }
  }catch(e){}
  var highRe=/Adreno(?:\\s*\\(TM\\))?\\s*(6[2-9]\\d|7\\d\\d|8\\d\\d)|Apple\\s*(A1[2-9]|A[2-9]\\d|M[1-9])|Mali-?G(7[1-9]|8\\d|9\\d\\d?)|Immortalis-?G\\d+|Xclipse\\s*9[2-9]\\d/i;
  var lowRe=/Adreno(?:\\s*\\(TM\\))?\\s*(30\\d|40\\d|50\\d|51[0-2])|Mali-?T\\d+|Mali-?4\\d\\d|Mali-?G(3\\d|5[0-2]|57)\\b|PowerVR\\s*(G6|GE8|GX6|7XT)|Vivante|VideoCore/i;
  if(r && highRe.test(r)){markHigh('webgl-allow');return;}
  if(r && lowRe.test(r)){markLow('webgl-deny');return;}
  if(weakDevice){markLow('device');return;}
  if(!isMobile){markHigh('desktop');return;}
  if(isApple){markHigh('apple-mobile');return;}
  // Android heuristic score (WebGL renderer is often masked by Chrome).
  // Conservative rule: RAM/cores/resolution alone do NOT prove a premium GPU
  // (budget phones like Infinix Note 11i can report 8GB/8 cores). Only clear
  // flagship model/WebGL signals or a very strong modern-device score promote.
  if(isAndroid){
    var score=0, reasons=[];
    var am=(ua.match(/Android\\s+(\\d+)/i)||[])[1];
    var av=am?parseInt(am,10):0;
    if(av){
      if(av<=11){score-=2;reasons.push('android'+av);}
      else if(av===12){score-=1;reasons.push('android'+av);}
      else if(av>=14){score+=1;reasons.push('android'+av);}
    } else {score-=1;reasons.push('android?');}
    // Memory: <=4 GB is low, 6 GB neutral-low, 8 GB modest, 12+ GB strong.
    if(mem){
      if(mem<=4){score-=3;reasons.push('mem'+mem);}
      else if(mem<=6){score-=1;reasons.push('mem'+mem);}
      else if(mem>=12){score+=2;reasons.push('mem'+mem);}
      else if(mem>=8){score+=1;reasons.push('mem'+mem);}
    } else {score-=1;reasons.push('mem?');}
    // CPU cores.
    if(cpu){
      if(cpu<=4){score-=3;reasons.push('cpu'+cpu);}
      else if(cpu<=6){score-=1;reasons.push('cpu'+cpu);}
      else if(cpu>=8){score+=1;reasons.push('cpu'+cpu);}
    } else {score-=1;reasons.push('cpu?');}
    // Screen size + DPR: flagships are typically >=1080p logical (>=390 CSS w & DPR>=2.75).
    var dpr=window.devicePixelRatio||1;
    var sw=Math.max(screen.width||0,screen.height||0);
    var physW=sw*dpr;
    if(physW>=2400 && dpr>=3){score+=1;reasons.push('hdpi');}
    else if(physW<=1600 || dpr<2){score-=1;reasons.push('ldpi');}
    // Network: save-data or slow effective type → low.
    try{
      var conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      if(conn){
        if(conn.saveData){score-=3;reasons.push('save-data');}
        var et=String(conn.effectiveType||'');
        if(et==='slow-2g'||et==='2g'||et==='3g'){score-=1;reasons.push(et);}
      }
    }catch(e){}
    // Touch-point ceiling (some entry-level chips report low): informative only.
    var mtp=navigator.maxTouchPoints||0;
    if(mtp && mtp<5){score-=1;reasons.push('tp'+mtp);}
    var veryStrongModern=(score>=5 && av>=13 && mem>=8 && cpu>=8);
    // Decision: require a very strong modern-device score for premium;
    // anything uncertain stays low/safe so overview cards shed heavy CSS.
    if(veryStrongModern){markHigh('android-score:'+score+'|'+reasons.join(','));}
    else{markLow('android-score:'+score+'|'+reasons.join(','));}
    // Async model check can still promote known flagships or demote known weak.
    try{
      var uad=navigator.userAgentData;
      if(uad&&uad.getHighEntropyValues){
        uad.getHighEntropyValues(['model','platform']).then(function(v){
          var m=String((v&&v.model)||'');
          if(/Pixel\\s*[7-9]|Pixel\\s*[1-9]\\d|SM-S\\d{2}|SM-F\\d{2}|SM-N\\d{3}|OnePlus\\s*(9|1\\d)|ASUS_AI|ROG|Xiaomi\\s*1[3-9]|22\\d{2}|23\\d{2}/i.test(m)){
            d.classList.remove('low-gpu');d.classList.add('high-gpu');try{d.dataset.gpuTier='high';d.dataset.gpuReason='model-flagship:'+m;}catch(e){}
          } else if(/Infinix|X6813|Note\\s*11i|TECNO|itel|Nokia\\s*C|Redmi\\s*(9|A)|Realme\\s*C/i.test(m)){
            d.classList.remove('high-gpu');d.classList.add('low-gpu');try{d.dataset.gpuTier='low';d.dataset.gpuReason='model-weak:'+m;}catch(e){}
          }
        }).catch(function(){});
      }
    }catch(e){}
    return;
  }
  // Non-Android mobile (rare fallthrough): be conservative.
  markLow('mobile-default');

}catch(e){}})();`,
          }}
        />
        <script
          // Optional GPU debug badge — activate with ?gpuDebug=1
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  if(!/[?&]gpuDebug=1/.test(location.search))return;
  addEventListener('DOMContentLoaded',function(){
    var d=document.documentElement;
    var b=document.createElement('div');
    b.textContent='GPU: '+(d.dataset.gpuTier||'default')+' ('+(d.dataset.gpuReason||'-')+')';
    b.style.cssText='position:fixed;bottom:8px;left:8px;z-index:99999;background:#000c;color:#0f0;font:11px/1.2 monospace;padding:4px 6px;border-radius:4px;pointer-events:none';
    document.body.appendChild(b);
  });
}catch(e){}})();`,
          }}
        />
      </head>
      <body style={{ background: "#121214" }}>
        {/* Pre-hydration boot splash: painted with the very first HTML frame so
            there is no white flash / raw logo before React mounts. Removed by
            <BootSplash /> once the app is interactive. */}
        <div id="oventric-boot" aria-hidden>
          <img
            src="/__l5e/assets-v1/685da575-6dc3-4bb2-8c32-a75c68fd8b6a/oventric-full.png"
            alt=""
            draggable={false}
          />
          <div className="ob-icons">
            {[
              { c: "#ff4d6d", p: <><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></> },
              { c: "#ffb020", p: <><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" /></> },
              { c: "#22ff88", p: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></> },
              { c: "#00c2ff", p: <><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></> },
              { c: "#7aa2ff", p: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></> },
              { c: "#a855f7", p: <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /> },
            ].map((it, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: it.c }}
              >
                {it.p}
              </svg>
            ))}
          </div>
          <style
            dangerouslySetInnerHTML={{
              __html: `#oventric-boot{position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#121214;transition:opacity .3s}
#oventric-boot img{height:48px;width:auto;user-select:none}
#oventric-boot .ob-icons{margin-top:24px;display:flex;align-items:center;gap:18px}
#oventric-boot svg{width:22px;height:22px;opacity:.18;transform:translateY(0) scale(.92);transition:opacity .25s ease,transform .25s ease,filter .25s ease}
#oventric-boot svg.ob-lit{opacity:1;transform:translateY(-3px) scale(1.12);filter:drop-shadow(0 0 10px currentColor)}`,
            }}
          />
          <script
            // Advance the icon sweep on real pre-hydration milestones:
            // HTML parsed → stylesheets/DOM ready → window load. React's
            // <BootSplash /> takes over (and removes this) once hydrated.
            dangerouslySetInnerHTML={{
              __html: `(function(){try{
  var root=document.getElementById('oventric-boot');if(!root)return;
  var svgs=root.getElementsByTagName('svg');
  var at=0;
  function set(n){if(n<=at)return;at=n;for(var i=0;i<svgs.length;i++){if(i<n)svgs[i].classList.add('ob-lit');}}
  set(1);
  document.addEventListener('DOMContentLoaded',function(){set(2);});
  window.addEventListener('load',function(){set(3);});
}catch(e){}})();`,
            }}
          />
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { show, markSeen, hydrated } = useFirstLaunch();
  // Welcome slides are a mobile-first onboarding experience; skip them on PC.
  const [isPc, setIsPc] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false,
  );
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsPc(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  // Keeps live FX rates fresh for every price conversion in the app.
  useLiveFx();

  // Browsers block audio until the user interacts; prime the chime engine once.
  useEffect(() => {
    const unlock = () => unlockNotificationSound();
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);




  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthGateProvider>
          <OnboardingProvider>
            <KycGateProvider>
              <AuthSeeder />
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
              <StageModals />
              <ProfileSetupModalHost />
              <ReactivationGate />
              <GlobalMobileNav />
              <Toaster position="top-center" richColors closeButton />
              <BootSplash />
              {show && hydrated && !isPc && <FeatureCarousel onComplete={markSeen} />}
            </KycGateProvider>

          </OnboardingProvider>
        </AuthGateProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
