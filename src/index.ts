interface Env {
  ASSETS: Fetcher;
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'trk',
  'ref',
  'source',
]);

function isAssetPath(pathname: string): boolean {
  return /\.\w{2,8}$/i.test(pathname);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let redirect = false;

    if (url.hostname === 'www.icra.builders') {
      url.hostname = 'icra.builders';
      redirect = true;
    }

    if (!url.pathname.endsWith('/') && !isAssetPath(url.pathname)) {
      url.pathname = url.pathname + '/';
      redirect = true;
    }

    for (const param of TRACKING_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        redirect = true;
      }
    }

    if (redirect) {
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
