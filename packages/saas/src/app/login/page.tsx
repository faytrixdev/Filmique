import LoginForm from './login-form';

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 480, margin: '12vh auto', fontFamily: 'system-ui' }}>
      <h1>Filmique</h1>
      <p>Un lien de connexion, pas de mot de passe.</p>
      <LoginForm />
    </main>
  );
}
