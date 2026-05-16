"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, useUser } from "@/firebase";
import { 
  initiateAnonymousSignIn, 
  initiateEmailSignIn, 
  initiateEmailSignUp, 
  initiateGoogleSignIn,
  resendVerificationEmail 
} from "@/firebase/non-blocking-login";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Zap, Mail, Lock, LogOut, AlertCircle, CheckCircle2 } from "lucide-react";
import { TacticalButton, OutlineButton } from "@/components/atoms";
import { useNativeBridge } from "@/hooks/use-native-bridge";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { isNative, callNative } = useNativeBridge();

  // Escuchar login exitoso desde Android
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.onGoogleLoginSuccess = async (idToken: string) => {
        setIsLoading(true);
        try {
          const { GoogleAuthProvider, signInWithCredential } = await import("firebase/auth");
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
        } catch (err: any) {
          setErrorMsg("Error de sincronización nativa: " + err.message);
        } finally {
          setIsLoading(false);
        }
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.onGoogleLoginSuccess = undefined;
      }
    };
  }, [auth]);

  // If user is logged in AND verified (or anonymous), go to app.
  useEffect(() => {
    if (user && !isUserLoading) {
      if (user.isAnonymous || user.emailVerified) {
        router.push("/");
      }
    }
  }, [user, isUserLoading, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);
    
    try {
      if (isRegistering) {
        await initiateEmailSignUp(auth, email, password);
        setSuccessMsg("¡Cuenta creada! Hemos enviado un correo de verificación. Por favor, revisa tu bandeja de entrada o spam.");
      } else {
        await initiateEmailSignIn(auth, email, password);
        // If not verified, they stay on this page because of the useEffect logic
        if (auth.currentUser && !auth.currentUser.emailVerified) {
          setErrorMsg("Debes verificar tu correo electrónico antes de entrar.");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error de autenticación.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMsg("");
    setIsLoading(true);
    try {
      if (isNative) {
        callNative('googleLogin');
      } else {
        await initiateGoogleSignIn(auth);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error con Google.");
    } finally {
      if (!isNative) setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    setErrorMsg("");
    setIsLoading(true);
    try {
      await initiateAnonymousSignIn(auth);
    } catch (err: any) {
      setErrorMsg("Ocurrió un error al entrar como invitado.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    try {
      await resendVerificationEmail(auth);
      setSuccessMsg("Correo de verificación reenviado.");
      setErrorMsg("");
    } catch (err: any) {
      setErrorMsg("No se pudo reenviar el correo. Intenta de nuevo más tarde.");
    }
  };

  const handleSignOut = () => {
    auth.signOut();
    setErrorMsg("");
    setSuccessMsg("");
  };

  if (isUserLoading) return null;

  // Unverified User State
  if (user && !user.isAnonymous && !user.emailVerified) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="glass-card-elevated border-border bg-card/60 backdrop-blur-2xl text-center">
            <CardHeader className="space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/50">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-black tracking-tighter">Verifica tu Correo</CardTitle>
              <CardDescription>
                Hemos enviado un enlace de verificación a <br/>
                <strong className="text-foreground">{user.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {successMsg && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2 text-left">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <p>{successMsg}</p>
                </div>
              )}
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}
              
              <div className="space-y-2 pt-4">
                <OutlineButton onClick={() => window.location.reload()} className="w-full">
                  Ya lo verifiqué
                </OutlineButton>
                <TacticalButton onClick={handleResendEmail} className="w-full">
                  Reenviar Correo
                </TacticalButton>
                <button onClick={handleSignOut} className="w-full py-2 mt-4 text-xs font-bold text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-colors">
                  <LogOut className="w-3 h-3" /> Usar otra cuenta
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Standard Login State
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="glass-card-elevated border-border bg-card/60 backdrop-blur-2xl">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(57,255,20,0.3)]">
              <Zap className="w-10 h-10 text-black" />
            </div>
            <div>
              <CardTitle className="text-3xl font-black tracking-tighter">
                {isRegistering ? "Unirse al Sistema" : "Acceso al Sistema"}
              </CardTitle>
              <CardDescription className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">
                {isRegistering ? "Crea tu perfil de alto rendimiento" : "Ingresa tus credenciales de acceso"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <AnimatePresence mode="wait">
              {errorMsg && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="p-3 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{errorMsg}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="alex@rivera.com" className="pl-10 bg-muted/30 border-border focus:border-primary/50" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" minLength={6} className="pl-10 bg-muted/30 border-border focus:border-primary/50" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
                </div>
              </div>
              <TacticalButton type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Procesando..." : isRegistering ? "Registrarse" : "Iniciar Sesión"}
              </TacticalButton>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-bold tracking-wider">O continuar con</span>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                variant="outline" 
                onClick={handleGoogle} 
                disabled={isLoading}
                className="w-full bg-white text-black hover:bg-gray-100 border-border font-medium h-10 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </Button>
              
              <OutlineButton onClick={handleGuest} className="w-full" disabled={isLoading}>
                Acceso como Invitado
              </OutlineButton>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {isRegistering ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
              <button onClick={() => {setIsRegistering(!isRegistering); setErrorMsg("");}} className="text-primary font-bold hover:underline">
                {isRegistering ? "Inicia sesión aquí" : "Regístrate ahora"}
              </button>
            </p>

            <div className="pt-6 border-t border-border flex justify-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              <a href="/privacy" className="hover:text-primary transition-colors">Privacidad</a>
              <span>•</span>
              <a href="/terms" className="hover:text-primary transition-colors">Términos</a>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
