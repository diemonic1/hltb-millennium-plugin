const HLTB_STYLES = `
#hltb-for-millennium {
  position: absolute;
  bottom: 0;
  right: 0;
  width: fit-content;
  z-index: 100;
}

.hltb-info {
  background: rgba(14, 20, 27, 0.85);
  border-top: 2px solid rgba(61, 68, 80, 0.54);
  padding: 8px 0;
}

.hltb-info ul {
  list-style: none;
  padding: 0 20px;
  margin: 0;
  display: flex;
  justify-content: space-evenly;
  align-items: center;
}

.hltb-info ul li {
  text-align: center;
  padding: 0 10px;
}

.hltb-info p {
  margin: 0;
  color: #ffffff;
}

.hltb-gametime {
  font-size: 16px;
  font-weight: bold;
}

.hltb-label {
  text-transform: uppercase;
  font-size: 10px;
  opacity: 0.7;
}

.hltb-details-btn {
  background: transparent;
  border: none;
  color: #1a9fff;
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  padding: 5px 10px;
}

.hltb-details-btn:hover {
  color: #ffffff;
}
`;

const STYLE_ID = 'hltb-styles';

export function injectStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = HLTB_STYLES;
  doc.head.appendChild(style);
}

export function removeStyles(doc: Document): void {
  doc.getElementById(STYLE_ID)?.remove();
}
