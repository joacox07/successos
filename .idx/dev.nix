# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"
  
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
  ];
  
  # Sets environment variables in the workspace
  env = {};
  
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      "dbaeumer.vscode-eslint"
      "esbenp.prettier-vscode"
    ];
    
    # Workspace lifecycle hooks
    lifecycle = {
      # Runs when a workspace is first created
      onCreate = {
        # Instalar dependencias backend y frontend
        npm-install = "npm install && cd web && npm install";
      };
      # Runs when the workspace is (re)started
      onStart = {
        # Build del proyecto
        build = "npm run build";
      };
    };
    
    # Enable previews
    previews = {
      enable = true;
      previews = {
        web = {
          # Este comando es útil si queremos configurar el comando dev del frontend
          command = ["npm" "run" "dev" "--prefix" "web"];
          manager = "web";
        };
      };
    };
  };
}
