import { Injectable, computed, inject, signal } from '@angular/core';
import { GameStateService } from './game-state.service';
import { CallOption, answerMessage, callOptions, callStatus, directory, markRead, placeCall, unreadCount } from '../engine/phone';
import { QuickSms, commentPost, publishPost, react, sendQuickSms, smsReady, socialFeed, socialLeft } from '../engine/phone-extra';
import { PostResult, goLive, socialStats } from '../engine/social';

/** Le téléphone : ouverture, conversation affichée, appels et réponses */
@Injectable({ providedIn: 'root' })
export class PhoneService {
  private readonly game = inject(GameStateService);
  readonly open = signal(false);
  readonly tab = signal<'messages' | 'repertoire' | 'reseaux'>('messages');
  readonly feed = computed(() => socialFeed(this.game.s()));
  readonly socialLeft = computed(() => socialLeft(this.game.s()));
  readonly reacted = computed(() => { const s = this.game.s().phone?.social; return s && s.week === this.game.s().week ? s.reacted : []; });
  readonly romance = computed(() => this.game.s().romance ?? null);
  /** Conversation ouverte (clé de l'interlocuteur) */
  readonly thread = signal<string | null>(null);
  readonly unread = computed(() => unreadCount(this.game.s()));
  readonly directory = computed(() => directory(this.game.s()));
  readonly calls = computed(() => callStatus(this.game.s()));

  /** Toutes les personnes nommables du jeu → clé de conversation (répertoire d'abord) */
  readonly people = computed(() => {
    const s = this.game.s();
    const map = new Map<string, string>();
    const add = (name: string | undefined, key: string) => {
      const n = (name ?? '').split(' · ')[0].trim();
      if (n.length >= 4 && !map.has(n) && n !== s.player.name) map.set(n, key);
    };
    for (const e of directory(s)) add(e.name, e.key);
    for (const n of s.npcs) add(n.name, `perso:${n.id}`);
    for (const c of s.contacts) add(c.name, `contact:${c.id}`);
    for (const r of s.player.team) add(r.name, `equipe:${r.id}`);
    return map;
  });

  /** La clé de conversation d'une personne, si elle existe */
  keyFor(name: string): string | null {
    return this.people().get((name ?? '').split(' · ')[0].trim()) ?? null;
  }

  /** Ouvrir la conversation téléphonique avec une personne */
  openPerson(name: string): boolean {
    const key = this.keyFor(name);
    if (!key) return false;
    this.show(key);
    return true;
  }

  show(who?: string): void {
    this.open.set(true);
    if (who) this.openThread(who);
  }

  close(): void {
    this.open.set(false);
    this.thread.set(null);
  }

  openThread(who: string): void {
    this.thread.set(who);
    if (this.game.s().phone?.messages.some(m => m.who === who && !m.read)) this.game.mutate(d => markRead(d, who));
  }

  options(who: string): CallOption[] {
    return callOptions(this.game.s(), who);
  }

  call(who: string, option: CallOption['id']): void {
    this.game.mutate((d, rng) => placeCall(d, who, option, rng));
  }

  canSms(who: string): boolean {
    return smsReady(this.game.s(), who);
  }

  sms(who: string, id: QuickSms['id']): void {
    this.game.mutate((d, rng) => sendQuickSms(d, who, id, rng));
  }

  react(msgId: string, emoji: string): void {
    this.game.mutate((d, rng) => react(d, msgId, emoji, rng));
  }

  comment(postId: string, tone: 'soutien' | 'pique' | 'humour'): string[] {
    let out: string[] = [];
    this.game.mutate((d, rng) => { out = commentPost(d, postId, tone, rng); });
    return out;
  }

  publish(kind: 'terrain' | 'coulisses' | 'vie' | 'tendance', tagIndex = 0): PostResult | null {
    let out: PostResult | null = null;
    this.game.mutate((d, rng) => { out = publishPost(d, kind, rng, tagIndex); });
    return out;
  }

  live(): PostResult | null {
    let out: PostResult | null = null;
    this.game.mutate((d, rng) => { out = goLive(d, rng); });
    return out;
  }

  /** Audience : abonnés, tendances, publications (lecture seule) */
  readonly audience = computed(() => {
    const s = this.game.s();
    const a = s.phone?.audience;
    return a && a.trendsWeek === s.week ? a : null;
  });

  /** Appels entrants urgents en attente */
  readonly urgent = computed(() => (this.game.s().phone?.messages ?? []).filter(m => m.urgent && !m.answered));

  /** Prépare l'audience du mois (tendances) à l'ouverture des réseaux */
  ensureAudience(): void {
    const s = this.game.s();
    if (s.phone?.audience?.trendsWeek !== s.week) this.game.mutate(d => { socialStats(d); });
  }

  reply(msgId: string, replyId: string): void {
    this.game.mutate((d, rng) => answerMessage(d, msgId, replyId, rng));
  }
}
