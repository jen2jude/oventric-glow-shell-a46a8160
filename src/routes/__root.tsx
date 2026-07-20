import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

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
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          // Detect low-end GPU/CPU BEFORE first paint and toggle `html.low-gpu`.
          // Heuristics: manual override → prefers-reduced-motion → mobile UA with
          // low deviceMemory / hardwareConcurrency / weak WebGL renderer/device.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  var d=document.documentElement;
  function mark(reason){d.classList.add('low-gpu');try{d.dataset.gpuTier='low';d.dataset.gpuReason=reason||'detected';}catch(e){}}
  var override=null;try{override=localStorage.getItem('oventric:gpu-mode');}catch(e){}
  if(override==='low'){mark('manual');return;}
  if(override==='high'){d.dataset.gpuTier='high';return;}
  var ua=navigator.userAgent||'';
  var isMobile=/Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  var isAndroid=/Android/i.test(ua);
  var weakDevice=/Infinix|Infinix\\s+X6813|X6813|Note\\s*11i|TECNO|itel/i.test(ua);
  var mem=navigator.deviceMemory||0;
  var cpu=navigator.hardwareConcurrency||0;
  var reduce=false;try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
  var weakGpu=false;
  try{
    var c=document.createElement('canvas');
    var gl=c.getContext('webgl')||c.getContext('experimental-webgl');
    if(gl){
      var ext=gl.getExtension('WEBGL_debug_renderer_info');
      var r=ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)||''):String(gl.getParameter(gl.RENDERER)||'');
      if(/Mali[\\s-]?(4|T|G(31|51|52|57)(\\s*MC\\d+)?)|Mali[\\s-]?G52\\s*MC2|Adreno \\(TM\\) [3-5]\\d\\d|PowerVR|Vivante|VideoCore/i.test(r)) weakGpu=true;
      if(isAndroid&&!r){weakGpu=true;}
    } else { weakGpu=true; }
  }catch(e){}
  if(reduce){mark('reduced-motion');return;}
  if(isMobile && (weakDevice || weakGpu || (mem&&mem<=4) || (cpu&&cpu<=4))){mark(weakDevice?'device':weakGpu?'webgl':'hardware');}
  try{
    var uad=navigator.userAgentData;
    if(isAndroid&&uad&&uad.getHighEntropyValues){
      uad.getHighEntropyValues(['model','platform']).then(function(v){
        var m=String((v&&v.model)||'');
        if(/Infinix|X6813|Note\\s*11i|Mali[\\s-]?G52/i.test(m)){mark('model');}
      }).catch(function(){});
    }
  }catch(e){}
}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();

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
            </KycGateProvider>

          </OnboardingProvider>
        </AuthGateProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
