{
  description = "nectar dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.nodePackages.pnpm
            pkgs.git
          ];
          NODE_OPTIONS = "--max_old_space_size=4096";

          shellHook = ''
            echo "nectar dev shell on your ${system}"
            echo "node: $(node -v) | pnpm: $(pnpm -v)"
            test -f package.json || echo "tip: pnpm init -y && pnpm i"
          '';
        };

        formatter = pkgs.nixpkgs-fmt;
      }
    );
}
