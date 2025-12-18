import { selectBestSportradarAsset } from "../src/media/imageSelector.js";

describe("selectBestSportradarAsset", () => {
  test("prefers original.jpg over resized and flag images", () => {
    const assets = [
      "https://api.sportradar.com/.../small.jpg",
      "https://api.sportradar.com/.../country_flag.png",
      "https://api.sportradar.com/.../original.jpg",
    ];

    const best = selectBestSportradarAsset(assets);
    expect(best).toContain("original.jpg");
  });
});
