import { Injectable, computed, inject, signal } from '@angular/core';
import { GameStateService } from './game-state.service';
import { CallOption, answerMessage, callOptions, callStatus, directory, markRead, placeCall, unreadCount } from '../engine/phone';
import { QuickSms, commentPost, publishPost, react, sendQuickSms, smsReady, socialFeed, socialLeft } from '../engine/phone-extra';

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

  publish(kind: 'terrain' | 'coulisses' | 'vie'): string[] {
    let out: string[] = [];
    this.game.mutate((d, rng) => { out = publishPost(d, kind, rng); });
    return out;
  }

  reply(msgId: string, replyId: string): void {
    this.game.mutate((d, rng) => answerMessage(d, msgId, replyId, rng));
  }
}
