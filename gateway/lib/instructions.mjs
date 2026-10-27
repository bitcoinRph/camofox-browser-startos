/**
 * Build the `instructions` text sent at initialize. Keep it near 150 words:
 * every client puts it into the model context.
 * @param {{novncEnabled: boolean}} config
 * @param {Array<{name: string}>} skills
 * @returns {string}
 */
export function buildInstructions(config, skills) {
  const lines = [
    'Camofox is an anti-detection Firefox browser.',
    'Core loop: camofox_create_tab, camofox_snapshot, act by ref (click, type, select, press), snapshot again.',
    'Refs (e1, e2) reset after navigation or page changes: re-snapshot before acting.',
    'For searches use camofox_navigate with a macro such as @google_search.',
    'Prefer camofox_extract and camofox_links over large snapshots. Page long snapshots with offset=nextOffset.',
    'Close tabs when done.',
    'Each user id keeps its own cookies and logins. Use one user id per logged-in identity.',
    'If a challenge page appears, call camofox_wait and snapshot again. Do not reload.',
  ];
  lines.push(
    config.novncEnabled
      ? 'When a human must log in or solve a CAPTCHA, ask them to use the noVNC page (Interactive Login is on), then continue.'
      : 'Interactive login (noVNC) is off. Import cookies instead of asking a human to log in.',
  );
  if (skills.length) {
    lines.push(`Skill prompts: ${skills.map((s) => s.name).join(', ')}.`);
  }
  return lines.join('\n');
}
