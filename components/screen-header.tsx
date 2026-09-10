import type { ReactNode } from "react";

type ScreenHeaderProps = {
  kicker: string;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
};

export function ScreenHeader({ kicker, title, description, action }: ScreenHeaderProps) {
  return (
    <header className="screen-header page-header">
      <div>
        <p className="screen-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="screen-subtitle">{description}</p>
      </div>
      {action}
    </header>
  );
}
