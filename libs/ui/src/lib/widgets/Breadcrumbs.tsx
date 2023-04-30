/* eslint-disable jsx-a11y/anchor-is-valid */
export interface BreadcrumbsProps {
  items: { id: string; label: string; metadata?: any }[];
  currentItem?: string;
  onClick: (item: { id: string; label: string; metadata?: any }) => void;
}

export function Breadcrumbs({ items, currentItem, onClick }: BreadcrumbsProps) {
  return (
    <nav role="navigation" aria-label="Breadcrumbs">
      <ol className="slds-breadcrumb slds-list_horizontal slds-wrap">
        {items.map((item, i) => (
          <li key={`${item.id}_${i}`} className="slds-breadcrumb__item">
            <a
              onClick={(event) => {
                event.preventDefault();
                onClick(item);
              }}
            >
              {item.label}
            </a>
          </li>
        ))}
        {currentItem && <li className="slds-breadcrumb__item slds-p-left_x-small">{currentItem}</li>}
      </ol>
    </nav>
  );
}
