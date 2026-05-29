import React from "react";
import { Route, Switch } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useTitleProps } from "src/hooks/title";
import Image from "./ImageDetails/Image";
import { FilteredImageList } from "./ImageList";
import { View } from "../List/views";
import { lazyComponent } from "src/utils/lazyComponent"; // CUSTOM

const UnifiedViewer = lazyComponent(() => import("../Viewers/UnifiedViewer")); // CUSTOM

const Images: React.FC = () => {
  return <FilteredImageList view={View.Images} />;
};

const ImageRoutes: React.FC = () => {
  const titleProps = useTitleProps({ id: "images" });
  return (
    <>
      <Helmet {...titleProps} />
      <Switch>
        <Route exact path="/images" component={Images} />
        <Route exact path="/images/viewer" component={UnifiedViewer} />{" "}
        {/* CUSTOM */}
        <Route path="/images/:id" component={Image} />
      </Switch>
    </>
  );
};

export default ImageRoutes;
