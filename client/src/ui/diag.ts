/**
 * `?diag=1`: the real screen numbers in a corner (window and visual viewport size, zoom, pixel ratio and the
 * safe-area insets), to read off a phone.
 */
export function diagOverlay() {
  if (!new URLSearchParams(location.search).has('diag')) return
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
  const out = document.createElement('pre')
  out.style.cssText =
    'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;margin:0;padding:6px 8px;background:#000c;color:#0f0;font:12px monospace;pointer-events:none;white-space:pre'
  document.body.append(probe, out)
  const draw = () => {
    const v = visualViewport
    const s = getComputedStyle(probe)
    out.textContent = [
      `inner ${innerWidth} x ${innerHeight}`,
      v
        ? `visual ${v.width.toFixed(1)} x ${v.height.toFixed(1)} scale ${v.scale.toFixed(3)}`
        : 'visual n/a',
      `dpr ${devicePixelRatio}`,
      `safe t ${s.paddingTop} r ${s.paddingRight} b ${s.paddingBottom} l ${s.paddingLeft}`,
      `zoom lock ${document.documentElement.classList.contains('no-zoom') ? 'on' : 'off'}`,
    ].join('\n')
  }
  addEventListener('resize', draw)
  visualViewport?.addEventListener('resize', draw)
  visualViewport?.addEventListener('scroll', draw)
  setInterval(draw, 1000)
  draw()
}
