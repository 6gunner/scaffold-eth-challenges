import { PageHeader } from "antd";
import React from "react";

// displays a page header

export default function Header() {
  return (
    <a rel="noopener noreferrer">
      <PageHeader title="🏗 scaffold-eth" subTitle="Lazy Mint" style={{ cursor: "pointer" }} />
    </a>
  );
}
