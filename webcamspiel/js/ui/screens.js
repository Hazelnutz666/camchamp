// Switches the visible <section class="screen"> by id suffix: show('menu'), show('game'), ...
export function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
}

export const $ = (id) => document.getElementById(id);
