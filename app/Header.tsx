import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import React from "react";


const Header = () => {
  return (
    <div className="border-b py-4 bg-gray-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link href={"/"}>FileDrive</Link>
        <div className="gap-2 flex">
          <OrganizationSwitcher />
          <UserButton/>
        </div>
      </div>
    </div>
  );
};

export default Header;
