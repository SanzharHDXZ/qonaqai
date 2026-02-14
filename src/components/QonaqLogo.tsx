import { Link } from "react-router-dom";

interface QonaqLogoProps {
  size?: "sm" | "md" | "lg";
  linkTo?: string;
  className?: string;
}

export default function QonaqLogo({ size = "md", linkTo, className = "" }: QonaqLogoProps) {
  const sizeMap = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  };

  const content = (
    <span className={`font-display font-bold tracking-elegant ${sizeMap[size]} ${className}`}>
      <span className="text-primary">Qonaq</span>
      <span className="text-gold">AI</span>
    </span>
  );

  if (linkTo) {
    return <Link to={linkTo} className="inline-flex items-center gap-2">{content}</Link>;
  }

  return <span className="inline-flex items-center gap-2">{content}</span>;
}
