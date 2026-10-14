import { Component, computed, inject, input } from '@angular/core';
import { PhoneService } from '../../services/phone.service';

/** Le nom d'une personne : un clic ouvre la conversation téléphonique */
@Component({
  selector: 'app-person',
  template: `@if (key()) {<button type="button" class="plink" (click)="open($event)" [title]="'Ouvrir la conversation avec ' + name()">{{ name() }}</button>} @else {{{ name() }}}`,
  styles: `
    :host { display: inline; }
    .plink { display: inline; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer;
      text-decoration: underline dotted color-mix(in srgb, currentColor 45%, transparent); text-underline-offset: 3px; }
    .plink:hover, .plink:focus-visible { color: var(--accent); text-decoration-style: solid; }
  `,
})
export class PersonLinkComponent {
  private readonly phone = inject(PhoneService);
  readonly name = input.required<string>();
  protected readonly key = computed(() => this.phone.keyFor(this.name()));
  protected open(ev: Event): void {
    ev.stopPropagation();
    this.phone.openPerson(this.name());
  }
}

/** Un texte où chaque nom de personne connue devient un lien vers le téléphone */
@Component({
  selector: 'app-linked-text',
  imports: [PersonLinkComponent],
  template: `@for (p of parts(); track $index) {@if (p.person) {<app-person [name]="p.text" />} @else {{{ p.text }}}}`,
  styles: `:host { display: inline; }`,
})
export class LinkedTextComponent {
  private readonly phone = inject(PhoneService);
  readonly text = input<string>('');
  private readonly pattern = computed(() => {
    const names = [...this.phone.people().keys()].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return names.length ? new RegExp(`(${names.join('|')})`, 'g') : null;
  });
  protected readonly parts = computed(() => {
    const t = this.text() ?? '';
    const re = this.pattern();
    if (!re || !t) return [{ text: t, person: false }];
    return t.split(re).filter(x => x !== '').map(x => ({ text: x, person: this.phone.people().has(x) }));
  });
}
