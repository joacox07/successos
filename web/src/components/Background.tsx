import { useTheme } from '@/contexts/ThemeContext';

export function Background() {
  const { theme } = useTheme();

  if (theme === 'nothing') {
    return (
      <>
        <div className="fixed inset-0 pointer-events-none -z-10 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgb(var(--color-text-primary)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </>
    );
  }

  return (
    <>
      {/* Floating orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-accent-mint/[0.07] blur-[120px] animate-float" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-accent-violet/[0.07] blur-[100px] animate-float-delay" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-accent-coral/[0.05] blur-[100px] animate-float" />
      </div>
      {/* Noise overlay */}
      <div className="noise-overlay" />
    </>
  );
}
