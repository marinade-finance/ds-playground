import React from "react";
import ReactDOM from "react-dom";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { PagePlaygroundAlgo } from "./pages/page-playground-algo";

const router = createBrowserRouter([
    {
        path: "/",
        element: <PagePlaygroundAlgo />,
    },
]);

ReactDOM.render(<React.StrictMode>
    <RouterProvider router={router} />
</React.StrictMode>, document.getElementById("root"));