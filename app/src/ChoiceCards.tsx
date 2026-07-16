export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
}

interface ChoiceCardsProps {
  options: ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  stacked?: boolean;
}

export default function ChoiceCards({ options, value, onChange, stacked = false }: ChoiceCardsProps) {
  return (
    <div className={`choice-cards ${stacked ? "stacked" : ""}`}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={`choice-card ${value === option.value ? "active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.badge && <span className="choice-card-badge">{option.badge}</span>}
          <span className="choice-card-label">{option.label}</span>
          {option.description && <span className="choice-card-description">{option.description}</span>}
        </button>
      ))}
    </div>
  );
}
