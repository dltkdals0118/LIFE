import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Check, Leaf, LockKeyhole, Mail, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import type { useWorkspace } from './store';

type Store = ReturnType<typeof useWorkspace>;
type Mode = 'login' | 'signup' | 'reset';

const LABEL: Record<Mode, { title: string; sub: string; submit: string }> = {
  login: { title: '다시 만나 반가워요', sub: '이메일과 비밀번호로 로그인하면 모든 기기에서 이어집니다.', submit: '로그인' },
  signup: { title: '나의 공간 만들기', sub: '계정을 만들면 휴대폰과 PC가 같은 기록을 씁니다.', submit: '계정 만들기' },
  reset: { title: '비밀번호 재설정', sub: '가입한 이메일로 재설정 링크를 보내드립니다.', submit: '재설정 메일 받기' },
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <label className="auth-row"><span>{label}</span>{children}</label>;
}

/** 로그인 화면. 메인에 들어가기 전에 먼저 보인다 — 로그인 여부를 화면으로 알 수 있게 하기 위해서다. */
export function AuthGate({ store, onGuest, onDemo }: { store: Store; onGuest: () => void; onDemo: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');
  // 확인 메일을 기다리는 주소. 무료 플랜 SMTP 가 자주 막혀 재전송 자리가 필요하다.
  const [awaiting, setAwaiting] = useState('');
  const t = LABEL[mode];

  function go(next: Mode) { setMode(next); setProblem(''); setMessage(''); setPassword(''); setConfirm(''); }

  async function resend() {
    setProblem(''); setMessage(''); setBusy(true);
    try { await store.resendConfirmation(awaiting); setMessage('확인 메일을 다시 보냈어요. 몇 분 걸릴 수 있고 스팸함도 확인해 주세요.'); }
    catch (err) {
      const raw = (err as Error).message;
      setProblem(/rate limit|too many/i.test(raw)
        ? '메일 발송 한도에 걸렸습니다. 무료 플랜은 시간당 몇 통만 보낼 수 있어요 — 잠시 뒤 다시 시도하거나, Supabase 설정에서 이메일 확인을 끄면 바로 쓸 수 있습니다.'
        : raw);
    } finally { setBusy(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setProblem(''); setMessage(''); setBusy(true);
    try {
      if (mode === 'reset') {
        await store.resetPassword(email);
        setMessage('재설정 메일을 보냈어요. 메일의 링크를 눌러 새 비밀번호를 정해 주세요.');
      } else if (mode === 'signup') {
        if (password !== confirm) throw Error('두 비밀번호가 서로 다릅니다.');
        const needsConfirm = await store.signup(email, password);
        if (needsConfirm) { setAwaiting(email); setMessage('확인 메일을 보냈어요. 메일의 링크를 누른 뒤 이 화면에서 로그인해 주세요.'); }
      } else {
        await store.login(email, password);
      }
    } catch (err) {
      const raw = (err as Error).message;
      if (/email not confirmed|not confirmed/i.test(raw)) setAwaiting(email);
      setProblem(
        /email not confirmed|not confirmed/i.test(raw) ? '이메일 확인이 아직 끝나지 않았습니다. 받은 메일의 링크를 누르거나 아래에서 다시 보내 주세요.'
        : /invalid login credentials/i.test(raw) ? '이메일 또는 비밀번호가 맞지 않습니다. 계정이 없다면 아래에서 먼저 만들어 주세요.'
        : /already registered|already been registered/i.test(raw) ? '이미 가입된 이메일입니다. 로그인해 주세요.'
        : /email rate limit|rate limit/i.test(raw) ? '메일 발송 한도에 걸렸습니다. 잠시 뒤 다시 시도해 주세요.'
        : /password/i.test(raw) && /short|least/i.test(raw) ? '비밀번호는 8자 이상으로 정해 주세요.'
        : raw);
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><span className="auth-logo"><Leaf size={20} /></span><div><strong>LIFE</strong><small>YOUR LIFE, IN PROGRESS</small></div></div>

        {!store.config && <p className="auth-problem">동기화 서비스가 연결되지 않았습니다. 이 기기에만 저장하고 시작할 수 있어요.</p>}

        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => go('login')}>로그인</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => go('signup')}>회원가입</button>
        </div>

        <h1>{t.title}</h1>
        <p className="auth-sub">{t.sub}</p>

        <form onSubmit={submit}>
          <Row label="이메일"><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" placeholder="name@example.com" /></Row>
          {mode !== 'reset' && <Row label="비밀번호"><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="8자 이상" /></Row>}
          {mode === 'signup' && <Row label="비밀번호 확인"><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="한 번 더 입력" /></Row>}
          {problem && <p className="auth-problem" role="alert">{problem}</p>}
          {message && <p className="auth-message"><Check size={15} />{message}</p>}
          {awaiting && <div className="auth-resend"><p><TriangleAlert size={13} />메일이 오지 않나요? 무료 플랜은 시간당 몇 통만 보낼 수 있어요. <b>스팸함</b>도 확인해 주세요.</p><button type="button" className="secondary full" disabled={busy} onClick={() => void resend()}><RefreshCw size={14} />{awaiting} 로 확인 메일 다시 보내기</button></div>}
          <button className="primary full" disabled={busy || !store.config}>{busy ? '처리 중…' : t.submit}<ArrowRight size={16} /></button>
        </form>

        <div className="auth-links">
          {mode === 'login' && <><button type="button" className="text-button" onClick={() => go('signup')}>계정이 없어요 · 회원가입</button><button type="button" className="text-button" onClick={() => go('reset')}><LockKeyhole size={13} />비밀번호를 잊으셨나요?</button></>}
          {mode === 'signup' && <button type="button" className="text-button" onClick={() => go('login')}>이미 계정이 있어요 · 로그인</button>}
          {mode === 'reset' && <button type="button" className="text-button" onClick={() => go('login')}>로그인으로 돌아가기</button>}
        </div>

        <hr />
        <div className="auth-alt">
          <button type="button" className="secondary full" onClick={onDemo}><Sparkles size={15} />로그인 없이 둘러보기</button>
          <button type="button" className="text-button" onClick={onGuest}>이 기기에만 저장하고 시작하기</button>
          <p className="auth-foot"><Mail size={13} />이 기기에만 저장하면 휴대폰과 연결되지 않습니다. 나중에 로그인하고 백업을 가져올 수 있어요.</p>
        </div>
      </div>
    </div>
  );
}

/** 재설정 링크로 돌아왔을 때 새 비밀번호를 정하는 화면. */
export function NewPassword({ store }: { store: Store }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setProblem(''); setBusy(true);
    try {
      if (password !== confirm) throw Error('두 비밀번호가 서로 다릅니다.');
      await store.updatePassword(password);
    } catch (err) { setProblem((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="auth-screen"><div className="auth-card">
      <div className="auth-brand"><span className="auth-logo"><LockKeyhole size={19} /></span><div><strong>새 비밀번호</strong><small>RESET YOUR PASSWORD</small></div></div>
      <p className="auth-sub">새로 쓸 비밀번호를 정해 주세요. 다른 기기에서도 이 비밀번호로 로그인합니다.</p>
      <form onSubmit={submit}>
        <Row label="새 비밀번호"><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="8자 이상" /></Row>
        <Row label="비밀번호 확인"><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="한 번 더 입력" /></Row>
        {problem && <p className="auth-problem" role="alert">{problem}</p>}
        <button className="primary full" disabled={busy}>{busy ? '처리 중…' : '비밀번호 바꾸기'}<ArrowRight size={16} /></button>
      </form>
    </div></div>
  );
}
